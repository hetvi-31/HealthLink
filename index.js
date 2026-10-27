import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "./src/db.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const frontendOrigins = new Set((process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173,http://127.0.0.1:5174")
  .split(",").map((origin) => origin.trim()).filter(Boolean));
const sessionSecret = process.env.SESSION_SECRET || "local-development-session-secret-change-me";
if (process.env.NODE_ENV === "production" && sessionSecret.length < 32) {
  throw new Error("Set SESSION_SECRET to a unique random value of at least 32 characters in production.");
}
if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "true") {
  throw new Error("Set COOKIE_SECURE=true when deploying the API over HTTPS.");
}
const cookieName = "healthlink_session";
const sessionMs = 8 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: process.env.COOKIE_SAME_SITE || "lax",
  path: "/",
  maxAge: sessionMs
};
const recordCollections = ["reports", "prescriptions", "reminders", "visits", "notes", "accessHistory", "prescriptionFiles"];

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Request origin is not allowed."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));
const standardJsonParser = express.json({ limit: "2mb" });
const medicalDocumentJsonParser = express.json({ limit: "15mb" });
app.use((req, res, next) => {
  const isDocumentUpload = req.method === "POST" && req.path === "/api/medical-history/documents";
  (isDocumentUpload ? medicalDocumentJsonParser : standardJsonParser)(req, res, next);
});
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !frontendOrigins.has(req.get("origin"))) {
    return res.status(403).json({ message: "Request origin is not allowed." });
  }
  next();
});

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const hashToken = (value) => crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
const readCookie = (req, name) => {
  const pair = (req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
};
const sendSessionCookie = (res, token) => res.cookie(cookieName, token, cookieOptions);
const clearSessionCookie = (res) => res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
const publicUser = (user) => ({ role: user.role, id: user.public_id, name: user.name, email: user.email });
const safeProfile = (profile) => {
  const { password, ...safe } = profile || {};
  return safe;
};
const doctorVisibleProfile = (profile) => {
  const safe = safeProfile(profile);
  delete safe.accessCode;
  return safe;
};
const asList = (value) => Array.isArray(value) ? value : String(value || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "healthlink-api" }));

const loginSchema = z.object({
  role: z.enum(["patient", "doctor"]),
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200)
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
app.post("/api/auth/login", authLimiter, asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter your role, ID or email, and password." });
  const { role, identifier, password } = parsed.data;
  const { rows: [user] } = await pool.query(
    `SELECT u.id, u.role, u.login_id, u.email, u.name, u.password_hash, p.public_id
     FROM users u JOIN profiles p ON p.user_id = u.id
     WHERE u.role = $1 AND (LOWER(u.login_id) = LOWER($2) OR LOWER(COALESCE(u.email, '')) = LOWER($2))`,
    [role, identifier]
  );
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: "Invalid HealthLink ID or password." });
  }
  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '8 hours')",
    [hashToken(token), user.id]
  );
  sendSessionCookie(res, token);
  res.json({ user: publicUser(user) });
}));

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
  age: z.coerce.number().int().min(1).max(120),
  gender: z.string().max(40).default("Prefer not to say"),
  bloodGroup: z.string().max(5).default("Unknown"),
  height: z.coerce.number().min(0).max(300).default(0),
  weight: z.coerce.number().min(0).max(500).default(0),
  phone: z.string().max(40).default(""),
  emergencyContact: z.string().max(40).default(""),
  address: z.string().max(500).default(""),
  conditions: z.union([z.string(), z.array(z.string())]).default([]),
  allergies: z.union([z.string(), z.array(z.string())]).default([]),
  medications: z.union([z.string(), z.array(z.string())]).default([]),
  surgeries: z.union([z.string(), z.array(z.string())]).default([]),
  familyHistory: z.string().max(3000).default("")
});

app.post("/api/auth/register", authLimiter, asyncRoute(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Check the registration details." });
  const values = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const countResult = await client.query("SELECT nextval('patient_login_seq') AS number");
    const number = Number(countResult.rows[0].number);
    const id = `P${String(number).padStart(4, "0")}`;
    const patientId = `PAT-${new Date().getFullYear()}-${String(number - 1000).padStart(3, "0")}`;
    const accessCode = `ACCESS-${crypto.randomInt(10000, 100000)}`;
    const profile = {
      id, patientId, name: values.name, email: values.email, age: values.age, gender: values.gender,
      bloodGroup: values.bloodGroup, height: values.height, weight: values.weight, phone: values.phone,
      emergencyContact: values.emergencyContact, address: values.address, photo: "", conditions: asList(values.conditions),
      allergies: asList(values.allergies), medications: asList(values.medications), surgeries: asList(values.surgeries),
      familyHistory: values.familyHistory, accessCode, doctorAccess: false
    };
    await client.query(
      "INSERT INTO users (id, role, login_id, email, password_hash, name) VALUES ($1, 'patient', $1, $2, $3, $4)",
      [id, values.email.toLowerCase(), await bcrypt.hash(values.password, 12), values.name]
    );
    await client.query("INSERT INTO profiles (user_id, public_id, data) VALUES ($1, $2, $3::jsonb)", [id, patientId, JSON.stringify(profile)]);
    const token = crypto.randomBytes(32).toString("base64url");
    await client.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '8 hours')", [hashToken(token), id]);
    await client.query("COMMIT");
    sendSessionCookie(res, token);
    res.status(201).json({ user: { role: "patient", id: patientId, name: values.name, email: values.email.toLowerCase() } });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") return res.status(409).json({ message: "An account with this email already exists." });
    throw error;
  } finally {
    client.release();
  }
}));

const requireAuth = asyncRoute(async (req, res, next) => {
  const rawToken = readCookie(req, cookieName);
  if (!rawToken) return res.status(401).json({ message: "Please sign in to continue." });
  const { rows: [user] } = await pool.query(
    `SELECT u.id, u.role, u.name, u.email, p.public_id
     FROM sessions s JOIN users u ON u.id = s.user_id JOIN profiles p ON p.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(rawToken)]
  );
  if (!user) return res.status(401).json({ message: "Your session expired. Please sign in again." });
  req.user = user;
  next();
});

const medicalDocumentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]),
  dataBase64: z.string().min(1).max(14_000_000)
});
app.post("/api/medical-history/documents", requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== "patient") return res.status(403).json({ message: "Only patients can upload medical documents." });
  const parsed = medicalDocumentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Choose a supported PDF, Word, or image file under 10 MB." });
  const { fileName, mimeType, dataBase64 } = parsed.data;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(dataBase64)) {
    return res.status(400).json({ message: "The uploaded file data is invalid." });
  }
  const fileData = Buffer.from(dataBase64, "base64");
  if (!fileData.length || fileData.length > 10 * 1024 * 1024) return res.status(413).json({ message: "Choose a document no larger than 10 MB." });
  const id = `DOC-${crypto.randomUUID()}`;
  const safeName = fileName.replace(/[\/\0-\x1f]/g, "_");
  await pool.query(
    "INSERT INTO patient_documents (id, patient_id, author_user_id, file_name, mime_type, file_data) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, req.user.public_id, req.user.id, safeName, mimeType, fileData]
  );
  res.status(201).json({ id, fileName: safeName });
}));
app.get("/api/medical-history/documents/:id", requireAuth, asyncRoute(async (req, res) => {
  const { rows: [document] } = await pool.query(
    `SELECT d.patient_id, d.file_name, d.mime_type, d.file_data,
       EXISTS (SELECT 1 FROM profiles p JOIN patient_grants g ON g.patient_user_id = p.user_id
               WHERE p.public_id = d.patient_id AND g.doctor_user_id = $2 AND g.expires_at > NOW()) AS doctor_allowed
     FROM patient_documents d WHERE d.id = $1`,
    [req.params.id, req.user.id]
  );
  if (!document) return res.status(404).json({ message: "Document not found." });
  const ownsDocument = req.user.role === "patient" && document.patient_id === req.user.public_id;
  const hasDoctorAccess = req.user.role === "doctor" && document.doctor_allowed;
  if (!ownsDocument && !hasDoctorAccess) return res.status(403).json({ message: "You do not have access to this document." });
  const downloadName = document.file_name.replace(/[^A-Za-z0-9._-]/g, "_");
  res.setHeader("Content-Type", document.mime_type);
  res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(document.file_data);
}));

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
app.post("/api/auth/logout", requireAuth, asyncRoute(async (req, res) => {
  await pool.query("DELETE FROM sessions WHERE user_id = $1 AND token_hash = $2", [req.user.id, hashToken(readCookie(req, cookieName))]);
  clearSessionCookie(res);
  res.status(204).end();
}));

async function getPortal(user) {
  const { rows: profiles } = await pool.query(
    `SELECT u.id, u.role, u.name, u.email, p.public_id, p.data
     FROM users u JOIN profiles p ON p.user_id = u.id ORDER BY u.created_at`
  );
  const doctors = profiles.filter((entry) => entry.role === "doctor").map((entry) => safeProfile(entry.data));
  const current = profiles.find((entry) => entry.id === user.id);
  let grantedPublicIds = [];
  if (user.role === "doctor") {
    const { rows: grants } = await pool.query(
      `SELECT p.public_id FROM patient_grants g JOIN profiles p ON p.user_id = g.patient_user_id
       WHERE g.doctor_user_id = $1 AND g.expires_at > NOW()`,
      [user.id]
    );
    grantedPublicIds = grants.map((grant) => grant.public_id);
  }
  const patients = user.role === "patient"
    ? [safeProfile(current.data)]
    : profiles.filter((entry) => entry.role === "patient" && grantedPublicIds.includes(entry.public_id)).map((entry) => doctorVisibleProfile(entry.data));
  const visiblePatientIds = patients.map((entry) => entry.patientId);

  const { rows: appointments } = await pool.query("SELECT data FROM appointments WHERE patient_id = $1 OR doctor_id = $2 ORDER BY created_at DESC", [
    user.role === "patient" ? user.public_id : "__none__",
    user.role === "doctor" ? user.public_id : "__none__"
  ]);
  const data = {
    patients,
    doctors,
    appointments: appointments.map((entry) => entry.data),
    reports: [], prescriptions: [], reminders: [], visits: [], notes: [], accessHistory: [], prescriptionFiles: [], notifications: [],
    settings: { emergencyNumber: "Configure in settings", language: "English" }
  };

  if (visiblePatientIds.length) {
    const { rows: records } = await pool.query(
      "SELECT collection, patient_id, data FROM patient_records WHERE patient_id = ANY($1::text[])",
      [visiblePatientIds]
    );
    for (const record of records) data[record.collection].push(record.data);
  }

  const { rows: notifications } = await pool.query(
    "SELECT data FROM notifications WHERE recipient_user_id = $1 ORDER BY created_at DESC",
    [user.id]
  );
  data.notifications = notifications.map((entry) => entry.data);
  return data;
}

app.get("/api/portal", requireAuth, asyncRoute(async (req, res) => res.json(await getPortal(req.user))));

const accessSchema = z.object({ patientId: z.string().trim().min(1).max(40), accessCode: z.string().trim().min(4).max(40) });
app.post("/api/access/verify", requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role !== "doctor") return res.status(403).json({ message: "Only doctors can verify patient access." });
  const parsed = accessSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter the patient ID and access code." });
  const { patientId, accessCode } = parsed.data;
  const { rows: [patient] } = await pool.query(
    `SELECT u.id AS user_id, p.data FROM profiles p JOIN users u ON u.id = p.user_id
     WHERE p.public_id = $1 AND u.role = 'patient'`, [patientId]
  );
  if (!patient || patient.data.doctorAccess !== true || patient.data.accessCode !== accessCode) {
    return res.status(403).json({ message: "Access denied. Ask the patient for a valid current code and permission." });
  }
  await pool.query(
    `INSERT INTO patient_grants (patient_user_id, doctor_user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 minutes')
     ON CONFLICT (patient_user_id, doctor_user_id) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [patient.user_id, req.user.id]
  );
  const id = `ACCESS-${crypto.randomUUID()}`;
  const history = { id, patientId, doctor: req.user.name, date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }), type: "Temporary code access" };
  await pool.query(
    "INSERT INTO patient_records (id, collection, patient_id, author_user_id, data) VALUES ($1, 'accessHistory', $2, $3, $4::jsonb)",
    [id, patientId, req.user.id, JSON.stringify(history)]
  );
  const portal = await getPortal(req.user);
  const grantedPatient = portal.patients.find((item) => item.patientId === patientId);
  res.json({ patient: grantedPatient, reports: portal.reports.filter((item) => item.patientId === patientId) });
}));

const profileFields = ["name", "email", "age", "gender", "bloodGroup", "height", "weight", "phone", "emergencyContact", "address", "photo", "conditions", "allergies", "medications", "surgeries", "familyHistory", "accessCode", "doctorAccess"];
const appointmentStatuses = new Set(["Pending", "Confirmed", "Completed", "Cancelled"]);
const profilePatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(254).optional(),
  age: z.number().int().min(1).max(120).optional(),
  gender: z.string().max(40).optional(),
  bloodGroup: z.string().max(5).optional(),
  height: z.number().min(0).max(300).optional(),
  weight: z.number().min(0).max(500).optional(),
  phone: z.string().max(40).optional(),
  emergencyContact: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  photo: z.string().max(1_500_000).optional(),
  conditions: z.array(z.string().max(250)).max(100).optional(),
  allergies: z.array(z.string().max(250)).max(100).optional(),
  medications: z.array(z.string().max(250)).max(100).optional(),
  surgeries: z.array(z.string().max(250)).max(100).optional(),
  familyHistory: z.string().max(3000).optional(),
  accessCode: z.string().regex(/^ACCESS-\d{5}$/).optional(),
  doctorAccess: z.boolean().optional()
}).strict();
const appointmentCreateSchema = z.object({
  id: z.string().min(1).max(80), patientId: z.string().min(1).max(40), doctorId: z.string().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/),
  consultationType: z.string().max(40).optional()
});
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

async function writePortal(user, body) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (user.role === "patient" && Array.isArray(body.patients)) {
      const own = body.patients.find((item) => item.patientId === user.public_id);
      if (own) {
        const { rows: [existing] } = await client.query("SELECT data FROM profiles WHERE user_id = $1 FOR UPDATE", [user.id]);
        const updated = { ...existing.data };
        const patch = Object.fromEntries(profileFields.filter((key) => Object.hasOwn(own, key)).map((key) => [key, own[key]]));
        const checked = profilePatchSchema.safeParse(patch);
        if (!checked.success) throw badRequest(checked.error.issues[0]?.message || "Invalid profile update.");
        Object.assign(updated, checked.data);
        updated.id = existing.data.id;
        updated.patientId = existing.data.patientId;
        delete updated.password;
        await client.query("UPDATE profiles SET data = $2::jsonb WHERE user_id = $1", [user.id, JSON.stringify(updated)]);
        if (updated.doctorAccess !== true || updated.accessCode !== existing.data.accessCode) {
          await client.query("DELETE FROM patient_grants WHERE patient_user_id = $1", [user.id]);
        }
        if (Object.hasOwn(own, "name") || Object.hasOwn(own, "email")) {
          await client.query("UPDATE users SET name = $2, email = $3 WHERE id = $1", [user.id, updated.name, updated.email.toLowerCase()]);
        }
      }
    }

    if (Array.isArray(body.appointments)) {
      const { rows: [profile] } = await client.query("SELECT data FROM profiles WHERE user_id = $1", [user.id]);
      for (const item of body.appointments) {
        const { rows: [stored] } = await client.query("SELECT data FROM appointments WHERE id = $1", [item.id]);
        if (!stored && user.role === "patient" && item.patientId === user.public_id) {
          const checked = appointmentCreateSchema.safeParse(item);
          if (!checked.success) throw badRequest("The appointment request has invalid details.");
          const { rows: [doctor] } = await client.query("SELECT public_id, data FROM profiles WHERE public_id = $1", [item.doctorId]);
          if (!doctor) continue;
          const created = { ...item, patientId: user.public_id, doctor: doctor.data.name, specialization: doctor.data.specialization, status: "Pending" };
          await client.query("INSERT INTO appointments (id, patient_id, doctor_id, data) VALUES ($1, $2, $3, $4::jsonb)", [item.id, user.public_id, doctor.public_id, JSON.stringify(created)]);
          const { rows: [doctorUser] } = await client.query("SELECT user_id FROM profiles WHERE public_id = $1", [doctor.public_id]);
          await addNotification(client, user.id, user.public_id, `Your appointment request with ${doctor.data.name} was sent.`);
          await addNotification(client, doctorUser.user_id, doctor.public_id, `New appointment request from ${profile.data.name} for ${item.date}.`);
        } else if (stored && user.role === "doctor" && stored.data.doctorId === user.public_id && item.status !== stored.data.status && appointmentStatuses.has(item.status)) {
          const updated = { ...stored.data, status: item.status };
          await client.query("UPDATE appointments SET data = $2::jsonb WHERE id = $1", [item.id, JSON.stringify(updated)]);
          const { rows: [patientUser] } = await client.query("SELECT user_id FROM profiles WHERE public_id = $1", [stored.data.patientId]);
          if (patientUser) await addNotification(client, patientUser.user_id, stored.data.patientId, `Your appointment with ${profile.data.name} was ${item.status.toLowerCase()}.`);
        }
      }
    }

    for (const collection of recordCollections) {
      if (!Array.isArray(body[collection])) continue;
      for (const item of body[collection]) {
        if (!item?.id || !item?.patientId) continue;
        if (collection === "reminders" && user.role === "patient" && item.patientId === user.public_id) {
          const { rows: [stored] } = await client.query("SELECT data FROM patient_records WHERE collection = $1 AND id = $2 AND patient_id = $3", [collection, item.id, user.public_id]);
          if (stored && Boolean(item.taken) !== Boolean(stored.data.taken)) {
            await client.query("UPDATE patient_records SET data = jsonb_set(data, '{taken}', to_jsonb($4::boolean)) WHERE collection = $1 AND id = $2 AND patient_id = $3", [collection, item.id, user.public_id, Boolean(item.taken)]);
          } else if (!stored) {
            await client.query("INSERT INTO patient_records (id, collection, patient_id, author_user_id, data) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING", [item.id, collection, user.public_id, user.id, JSON.stringify(item)]);
          }
          continue;
        }

        const patientOwnedCollections = ["reports", "visits", "prescriptionFiles"];
        if (user.role === "patient" && patientOwnedCollections.includes(collection) && item.patientId === user.public_id) {
          await client.query("INSERT INTO patient_records (id, collection, patient_id, author_user_id, data) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING", [item.id, collection, user.public_id, user.id, JSON.stringify(item)]);
          continue;
        }

        const doctorOwnedCollections = ["prescriptions", "notes", "accessHistory"];
        if (user.role === "doctor" && doctorOwnedCollections.includes(collection)) {
          const { rows: [patient] } = await client.query(
            `SELECT p.data FROM profiles p JOIN patient_grants g ON g.patient_user_id = p.user_id
             WHERE p.public_id = $1 AND g.doctor_user_id = $2 AND g.expires_at > NOW()`, [item.patientId, user.id]
          );
          if (!patient?.data?.doctorAccess) continue;
          const doctorName = (await client.query("SELECT data FROM profiles WHERE user_id = $1", [user.id])).rows[0]?.data?.name;
          const verified = { ...item, doctor: doctorName || item.doctor };
          await client.query("INSERT INTO patient_records (id, collection, patient_id, author_user_id, data) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT DO NOTHING", [item.id, collection, item.patientId, user.id, JSON.stringify(verified)]);
        }
      }
    }

    if (Array.isArray(body.notifications)) {
      for (const item of body.notifications) {
        if (!item?.id) continue;
        await client.query(
          "UPDATE notifications SET data = jsonb_set(data, '{read}', to_jsonb($3::boolean)) WHERE id = $1 AND recipient_user_id = $2",
          [item.id, user.id, Boolean(item.read)]
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addNotification(client, userId, publicId, text) {
  const id = `N-${crypto.randomUUID()}`;
  const data = { id, userId: publicId, text, read: false };
  await client.query("INSERT INTO notifications (id, recipient_user_id, data) VALUES ($1, $2, $3::jsonb)", [id, userId, JSON.stringify(data)]);
}

app.put("/api/portal", requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.record(z.string(), z.unknown()).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid portal update." });
  await writePortal(req.user, parsed.data);
  res.json(await getPortal(req.user));
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.status && error.status < 500) return res.status(error.status).json({ message: error.message });
  if (error.code === "23505") return res.status(409).json({ message: "This record already exists." });
  res.status(500).json({ message: "The server could not complete the request." });
});

app.listen(port, "0.0.0.0", () => console.log(`HealthLink API listening on port ${port}`));

