import "dotenv/config";
import bcrypt from "bcryptjs";
import { seedData } from "../../src/data/healthlinkStore.js";
import { pool } from "../src/db.js";

const omitPassword = ({ password, ...safe }) => safe;

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userByPublicId = new Map();

    for (const patient of seedData.patients) {
      const { rows: [user] } = await client.query(
        `INSERT INTO users (id, role, login_id, email, password_hash, name)
         VALUES ($1, 'patient', $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [patient.id, patient.id, patient.email, await bcrypt.hash(patient.password, 12), patient.name]
      );
      userByPublicId.set(patient.patientId, user.id);
      await client.query(
        `INSERT INTO profiles (user_id, public_id, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET public_id = EXCLUDED.public_id, data = EXCLUDED.data`,
        [user.id, patient.patientId, JSON.stringify(omitPassword(patient))]
      );
    }

    for (const doctor of seedData.doctors) {
      const { rows: [user] } = await client.query(
        `INSERT INTO users (id, role, login_id, email, password_hash, name)
         VALUES ($1, 'doctor', $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [doctor.id, doctor.id, doctor.email, await bcrypt.hash(doctor.password, 12), doctor.name]
      );
      userByPublicId.set(doctor.doctorId, user.id);
      await client.query(
        `INSERT INTO profiles (user_id, public_id, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET public_id = EXCLUDED.public_id, data = EXCLUDED.data`,
        [user.id, doctor.doctorId, JSON.stringify(omitPassword(doctor))]
      );
    }

    for (const appointment of seedData.appointments) {
      await client.query(
        `INSERT INTO appointments (id, patient_id, doctor_id, data) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [appointment.id, appointment.patientId, appointment.doctorId, JSON.stringify(appointment)]
      );
    }

    const recordCollections = ["reports", "prescriptions", "reminders", "visits", "notes", "accessHistory", "prescriptionFiles"];
    for (const collection of recordCollections) {
      for (const item of seedData[collection] || []) {
        const patientId = item.patientId;
        const authorId = collection === "notes" || collection === "prescriptions"
          ? (seedData.doctors.find((doctor) => doctor.name === item.doctor)?.id || null)
          : null;
        await client.query(
          `INSERT INTO patient_records (id, collection, patient_id, author_user_id, data)
           VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (collection, id) DO NOTHING`,
          [item.id || `${collection}-${Date.now()}-${Math.random()}`, collection, patientId, authorId, JSON.stringify(item)]
        );
      }
    }

    for (const notification of seedData.notifications) {
      const recipient = userByPublicId.get(notification.userId);
      if (!recipient) continue;
      await client.query(
        `INSERT INTO notifications (id, recipient_user_id, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [notification.id, recipient, JSON.stringify(notification)]
      );
    }

    await client.query("COMMIT");
    console.log("Demo accounts and sample records have been added.");
    console.log("Patient login: P1001 / patient123");
    console.log("Doctor login: D1001 / doctor123");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
