import { createContext, useContext, useEffect, useRef, useState } from "react";
import { healthLinkApi } from "./services/api";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellRing,
  Bot,
  CalendarCheck,
  ClipboardList,
  FileHeart,
  Globe2,
  HeartPulse,
  Home,
  LockKeyhole,
  MapPin,
  LogOut,
  Menu,
  Moon,
  Pill,
  Plus,
  PersonStanding,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Sun,
  TrendingUp,
  Upload,
  User,
  Video
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { calculateBmi, clearSession, loadData, loadSession, newId, saveData, saveSession } from "./data/healthlinkStore";
import { languageNames, translateText } from "./data/translations";

const LanguageContext = createContext("en");
const useLanguage = () => useContext(LanguageContext);
const tx = (text, language) => translateText(text, language);

const patientNav = [
  ["overview", Home, "Overview"],
  ["profile", User, "Profile"],
  ["history", FileHeart, "Medical History"],
  ["appointments", CalendarCheck, "Appointments"],
  ["doctors", Stethoscope, "Find a Doctor"],
  ["reports", Upload, "Reports"],
  ["prescriptions", ClipboardList, "Prescriptions"],
  ["analytics", Activity, "Analytics"],
  ["assistant", Bot, "MediAI"],
  ["reminders", Pill, "Reminders"],
  ["settings", Settings, "Settings"]
];

const doctorNav = [
  ["overview", Stethoscope, "Dashboard"],
  ["patients", Stethoscope, "Patients"],
  ["appointments", CalendarCheck, "Appointments"],
  ["prescriptions", ClipboardList, "Prescriptions"],
  ["notes", FileHeart, "Notes"],
  ["settings", Settings, "Settings"]
];

function App() {
  const [data, setData] = usePersistentData();
  const [session, setSession] = useState(loadSession);
  const [apiDataReady, setApiDataReady] = useState(() => !loadSession());
  const [view, setView] = useState(() => {
    const savedSession = loadSession();
    return savedSession?.role === "patient" ? "patient" : savedSession?.role === "doctor" ? "doctor" : "landing";
  });
  const [theme, setTheme] = useState(localStorage.getItem("healthlink-theme") || "light");
  const [language, setLanguage] = useState(localStorage.getItem("healthlink-language") || "en");
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("healthlink-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("healthlink-language", language);
  }, [language]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (message) => setToast(message);

  // Restore the server session and fetch canonical data after a page refresh.
  useEffect(() => {
    if (!session) {
      setApiDataReady(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { user } = await healthLinkApi.getMe();
        const portalData = await healthLinkApi.getPortal();
        if (cancelled) return;
        setData(portalData);
        const restored = { role: user.role, id: user.id, name: user.name };
        saveSession(restored);
        setSession(restored);
        setView(user.role === "doctor" ? "doctor" : "patient");
      } catch {
        if (cancelled) return;
        clearSession();
        setSession(null);
        setView("login");
        setToast("Your session expired. Please sign in again.");
      } finally {
        if (!cancelled) setApiDataReady(true);
      }
    })();
    return () => { cancelled = true; };
  // This bootstrap runs once for a session restored from browser storage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist portal changes to PostgreSQL after the UI state settles.
  useEffect(() => {
    if (!session || !apiDataReady) return undefined;
    const timer = setTimeout(() => {
      healthLinkApi.savePortal(data).catch((error) => {
        setToast(`Database save failed: ${error.message}`);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [data, session, apiDataReady]);

  const login = async (role, identifier, password) => {
    try {
      const { user } = await healthLinkApi.signIn({ role, identifier, password });
      const portalData = await healthLinkApi.getPortal();
      setData(portalData);

      const nextSession = { role: user.role, id: user.id, name: user.name };
      saveSession(nextSession);
      setSession(nextSession);
      setView(user.role === "doctor" ? "doctor" : "patient");
      notify(`Welcome ${user.name}`);
      return true;
    } catch (error) {
      notify(error.message || "Could not sign in.");
      return false;
    }
  };

  const logout = () => {
    healthLinkApi.signOut().catch(() => {});
    clearSession();
    setSession(null);
    setView("landing");
  };

  const registerPatient = async (payload) => {
    try {
      const { user } = await healthLinkApi.register(payload);
      const portalData = await healthLinkApi.getPortal();
      setData(portalData);
      const nextSession = { role: user.role, id: user.id, name: user.name };
      saveSession(nextSession);
      setSession(nextSession);
      setView("patient");
      notify(`Welcome ${user.name}`);
      return true;
    } catch (error) {
      notify(error.message || "Could not create your account.");
      return false;
    }
  };
  const sharedProps = { data, setData, session, setView, theme, setTheme, notify, logout, mobileNav, setMobileNav, language, setLanguage };

  const content = (
    <>
      {view === "landing" && <Landing setView={setView} theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} />}
      {view === "login" && <Login login={login} setView={setView} theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} notify={notify} />}
      {view === "register" && <Register onRegister={registerPatient} setView={setView} theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} />}
      {session?.role === "patient" && view === "patient" && <PatientPortal {...sharedProps} />}
      {session?.role === "doctor" && view === "doctor" && <DoctorPortal {...sharedProps} />}
      {toast && <div className="toast">{tx(toast, language)}</div>}
    </>
  );

  return <LanguageContext.Provider value={language}>{content}</LanguageContext.Provider>;
}

function usePersistentData() {
  const [data, setState] = useState(loadData);
  const setData = (updater) => {
    setState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      saveData(next);
      return next;
    });
  };
  return [data, setData];
}

function Landing({ setView, theme, setTheme, language, setLanguage }) {
  const features = [
    ["Connected records", ShieldCheck, "A patient-controlled health timeline for visits, documents and care plans."],
    ["Modern practice tools", Stethoscope, "Appointments, patient context and follow-ups in one workspace."],
    ["Insights at a glance", Activity, "Bring trends and patient-reported metrics into the care conversation."],
    ["Yoga & gentle movement", PersonStanding, "Condition-aware wellness ideas to discuss with your clinician."],
    ["AI-ready workflows", Bot, "A foundation for responsible clinical admin assistance, with review in the loop."],
    ["Care continuity", Pill, "Keep care plans, prescriptions and reminders visible between visits."],
    ["Built to connect", LockKeyhole, "Designed for future hospital, lab, pharmacy and telehealth integrations."]
  ];
  return (
    <main>
      <header className="site-header">
        <Brand />
        <nav className="nav-links">
          <a href="#features">Platform</a>
          <a href="#for-clinicians">For clinicians</a>
          
          <button className="btn secondary" onClick={() => setView("login")}>Sign in</button>
        </nav>
        <div className="top-actions"><LanguageSelect language={language} setLanguage={setLanguage} /><ThemeButton theme={theme} setTheme={setTheme} /></div>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> THE CONNECTED CARE PLATFORM</p>
          <h1>Care, connected.<br /><em>Practice, elevated.</em></h1>
          <p>One thoughtful workspace for the people who give care and the people who receive it. Bring patient context, appointments and follow-through together.</p>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => setView("register")}>Create your health profile <Plus size={18} /></button>
            <a className="btn ghost" href="#for-clinicians">Explore the platform <ArrowUpRight size={17} /></a>
          </div>
          <div className="hero-proof"><div className="proof-avatars"><span>AS</span><span>RM</span><span>NK</span></div><p><strong>One connected care journey</strong><br />Patients and clinicians, working together</p></div>
        </div>
        <div className="hero-visual">
          <img src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1100&q=85" alt="Doctor viewing a modern healthcare dashboard" />
          <div className="hero-image-label"><span className="hero-label-icon"><HeartPulse size={18} /></span><span><strong>Care that sees the whole picture</strong><small>Records · visits · follow-up</small></span><ArrowUpRight size={18} /></div>
          <div className="floating-card appointment-card"><span className="appointment-kicker">NEXT VISIT</span><CalendarCheck /><strong>10:30 <small>AM</small></strong><span>Dr. Ananya Shah · Video visit</span></div>
        </div>
      </section>
      <section className="trust-strip"><span>CARE THAT CONNECTS</span><b>Patient-first</b><i /> <b>Clinician-friendly</b><i /> <b>Integration-ready</b><i /> <b>Designed for trust</b></section>
      <section id="features" className="section platform-section">
        <SectionTitle eyebrow="A calmer way to coordinate care" title="The details of care, finally in one place." subtitle="Built around the moments that matter: before the visit, during the conversation, and after the patient goes home." />
        <div className="feature-grid">
          {features.map(([title, Icon, text], index) => <article className="feature-card" key={title}><span className="feature-number">0{index + 1}</span><span className="feature-icon"><Icon /></span><h3>{title}</h3><p>{text}</p><ArrowUpRight className="feature-arrow" size={18} /></article>)}
        </div>
      </section>
      <section id="yoga" className="yoga-landing section">
        <div className="yoga-landing-copy"><span className="yoga-symbol"><PersonStanding size={25} /></span><p className="eyebrow">WELLNESS, MADE PERSONAL</p><h2>Small moments of movement.<br />A little more room to breathe.</h2><p>Explore gentle, condition-aware yoga and relaxation ideas designed to complement your care plan.</p><button className="btn secondary" onClick={() => setView("login")}>Explore wellness suggestions <ArrowRight size={16} /></button></div>
        <div className="yoga-landing-card"><span className="yoga-label">YOUR GENTLE START</span><div className="yoga-pose"><PersonStanding size={44} /></div><strong>Restorative movement</strong><p>Try a short, comfortable session with a qualified instructor. Adapt or stop if anything feels uncomfortable.</p><small>Wellness support · not a treatment</small></div>
      </section>
      <section id="for-clinicians" className="clinician-band">
        <div className="clinician-copy"><p className="eyebrow">FOR CLINICIANS & CARE TEAMS</p><h2>More time for people.<br /><em>Less time chasing paperwork.</em></h2><p>A considered digital front desk for independent practices and growing clinics. Coordinate visits, keep patient context close, and help every follow-up find its way.</p><button className="btn light-btn" onClick={() => setView("login")}>Explore the doctor workspace <ArrowUpRight size={17} /></button></div>
        <div className="clinician-highlights"><div><span><CalendarCheck /></span><strong>Visit coordination</strong><small>Schedule and manage appointments.</small></div><div><span><FileHeart /></span><strong>Patient context</strong><small>Keep records and care notes connected.</small></div><div><span><TrendingUp /></span><strong>Practice insights</strong><small>See your day and follow-ups clearly.</small></div></div>
      </section>
      
      <footer className="footer"><Brand /><p>Better connected. More human.</p><small>HealthLink · Connected care for every chapter.</small></footer>
    </main>
  );
}

function Login({ login, setView, theme, setTheme, language, setLanguage, notify }) {
  const [role, setRole] = useState("patient");
  const [form, setForm] = useState({ identifier: "", password: "" });
  const fillDemo = (nextRole) => {
    setRole(nextRole);
    setForm(nextRole === "doctor" ? { identifier: "D1001", password: "doctor123" } : { identifier: "P1001", password: "patient123" });
  };
  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-art">
          <Brand onClick={() => setView("landing")} />
          <div><h1>Welcome back to HealthLink.</h1><p>Access a role-based portal for patients and doctors.</p></div>
          <img src="https://images.unsplash.com/photo-1559757175-0eb30cd8c063?auto=format&fit=crop&w=900&q=85" alt="Healthcare worker using digital medical records" />
        </div>
        <div className="auth-card">
          <div className="auth-tools"><LanguageSelect language={language} setLanguage={setLanguage} /><ThemeButton theme={theme} setTheme={setTheme} /></div>
          <h2>Login</h2>
          <div className="segmented">
            <button className={role === "patient" ? "active" : ""} onClick={() => setRole("patient")}>Patient</button>
            <button className={role === "doctor" ? "active" : ""} onClick={() => setRole("doctor")}>Doctor</button>
          </div>
          <form className="form" onSubmit={(event) => { event.preventDefault(); login(role, form.identifier.trim(), form.password); }}>
            <Field label="ID or Email" value={form.identifier} onChange={(identifier) => setForm({ ...form, identifier })} placeholder={role === "doctor" ? "D1001 or doctor@demo.com" : "P1001 or patient@demo.com"} required />
            <Field label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} required />
            <button className="btn primary full">Login</button>
          </form>
          <div className="auth-divider"><span>or continue with</span></div>
          <button type="button" className="google-btn" onClick={() => notify("Google sign-in needs OAuth client credentials and a backend callback before it can authenticate users.")}><GoogleMark /> Sign in with Google</button>
          <div className="demo-box">
            <strong>Demo Login</strong>
            <button className="btn subtle" onClick={() => fillDemo("patient")}>Patient: P1001 / patient123</button>
            <button className="btn subtle" onClick={() => fillDemo("doctor")}>Doctor: D1001 / doctor123</button>
          </div>
          <p className="center-text">No account? <button className="link-btn" onClick={() => setView("register")}>Create patient account</button></p>
        </div>
      </section>
    </main>
  );
}

function Register({ onRegister, setView, theme, setTheme, language, setLanguage }) {
  const [form, setForm] = useState({
    name: "Aarav Patel", dob: "1998-02-12", age: 28, gender: "Male", bloodGroup: "B+", email: "aarav@healthlink.demo", phone: "+91 98765 43210", password: "patient123", height: 175, weight: 72, emergencyContact: "+91 90000 11111", address: "Ahmedabad, Gujarat", conditions: "Mild asthma", allergies: "Dust", medications: "Vitamin D", surgeries: "Appendectomy - 2020", familyHistory: "Father: Hypertension. Mother: None recorded."
  });
  const update = (key, value) => setForm({ ...form, [key]: value });
  return (
    <>
      <header className="topbar"><Brand onClick={() => setView("landing")} /><div className="top-actions"><LanguageSelect language={language} setLanguage={setLanguage} /><ThemeButton theme={theme} setTheme={setTheme} /><button className="btn secondary" onClick={() => setView("login")}>Login</button></div></header>
      <main className="register-layout">
        <SectionTitle eyebrow="Patient registration" title="Create a HealthLink profile" subtitle="This creates a unique patient ID. For real deployment, move identity and consent to a secure backend." />
        <form className="panel form-grid" onSubmit={(event) => { event.preventDefault(); onRegister(form); }}>
          <Field label="Full Name" value={form.name} onChange={(v) => update("name", v)} required />
          <Field label="Date of Birth" type="date" value={form.dob} onChange={(v) => update("dob", v)} required />
          <Field label="Age" type="number" min="1" max="120" value={form.age} onChange={(v) => update("age", v)} required />
          <Select label="Gender" value={form.gender} onChange={(v) => update("gender", v)} options={["Male", "Female", "Other"]} required />
          <Select label="Blood Group" value={form.bloodGroup} onChange={(v) => update("bloodGroup", v)} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
          <Field label="Phone" value={form.phone} onChange={(v) => update("phone", v)} required />
          <Field label="Password" type="password" minLength={8} value={form.password} onChange={(v) => update("password", v)} required />
          <Field label="Height (cm)" type="number" min="30" max="250" value={form.height} onChange={(v) => update("height", v)} required />
          <Field label="Weight (kg)" type="number" min="1" max="500" value={form.weight} onChange={(v) => update("weight", v)} required />
          <Field label="Emergency Contact" type="tel" value={form.emergencyContact} onChange={(v) => update("emergencyContact", v)} required />
          <TextArea label="Address" value={form.address} onChange={(v) => update("address", v)} required wide />
          <TextArea label="Existing Diseases" value={form.conditions} onChange={(v) => update("conditions", v)} />
          <TextArea label="Allergies" value={form.allergies} onChange={(v) => update("allergies", v)} />
          <TextArea label="Current Medications" value={form.medications} onChange={(v) => update("medications", v)} />
          <TextArea label="Previous Surgeries" value={form.surgeries} onChange={(v) => update("surgeries", v)} />
          <TextArea label="Family Medical History" value={form.familyHistory} onChange={(v) => update("familyHistory", v)} wide />
          <button className="btn primary wide">Create HealthLink ID</button>
        </form>
      </main>
    </>
  );
}

function PatientPortal(props) {
  const { data, session, setData, logout, theme, setTheme, notify, mobileNav, setMobileNav, language, setLanguage } = props;
  const [active, setActive] = useState("overview");
  const patient = data.patients.find((item) => item.patientId === session.id);
  if (!patient) return null;
  const notifications = data.notifications.filter((item) => item.userId === patient.patientId);
  const markRead = () => setData((current) => ({ ...current, notifications: current.notifications.map((item) => item.userId === patient.patientId ? { ...item, read: true } : item) }));
  const unread = notifications.filter((item) => !item.read).length;
  return (
    <PortalShell nav={patientNav} active={active} setActive={setActive} theme={theme} setTheme={setTheme} logout={logout} mobileNav={mobileNav} setMobileNav={setMobileNav} notificationCount={unread} notifications={notifications} markNotificationsRead={markRead} language={language} setLanguage={setLanguage}>
      {active === "overview" && <PatientOverview data={data} patient={patient} />}
      {active === "profile" && <PatientProfile patient={patient} setData={setData} notify={notify} />}
      {active === "history" && <MedicalHistory data={data} patient={patient} setData={setData} notify={notify} />}
      {active === "appointments" && <PatientAppointments data={data} patient={patient} setData={setData} notify={notify} />}
      {active === "doctors" && <DoctorDirectory data={data} setData={setData} notify={notify} />}
      {active === "reports" && <Reports data={data} patient={patient} setData={setData} notify={notify} />}
      {active === "prescriptions" && <Prescriptions data={data} patient={patient} setData={setData} notify={notify} />}
      {active === "analytics" && <Analytics />}
      {active === "assistant" && <Assistant data={data} patient={patient} />}
      {active === "reminders" && <Reminders data={data} patient={patient} setData={setData} notify={notify} />}
      {active === "settings" && <PatientSettings data={data} patient={patient} setData={setData} notify={notify} />}
    </PortalShell>
  );
}

function DoctorPortal(props) {
  const { data, session, setData, logout, theme, setTheme, notify, mobileNav, setMobileNav, language, setLanguage } = props;
  const [active, setActive] = useState("overview");
  const doctor = data.doctors.find((item) => item.doctorId === session.id);
  if (!doctor) return null;
  const notifications = data.notifications.filter((item) => item.userId === doctor.doctorId);
  const markRead = () => setData((current) => ({ ...current, notifications: current.notifications.map((item) => item.userId === doctor.doctorId ? { ...item, read: true } : item) }));
  return (
    <PortalShell nav={doctorNav} active={active} setActive={setActive} theme={theme} setTheme={setTheme} logout={logout} mobileNav={mobileNav} setMobileNav={setMobileNav} notifications={notifications} notificationCount={notifications.filter((item) => !item.read).length} markNotificationsRead={markRead} language={language} setLanguage={setLanguage}>
      {active === "overview" && <DoctorOverview data={data} doctor={doctor} setData={setData} notify={notify} setActive={setActive} />}
      {active === "patients" && <PatientTable data={data} />}
      {active === "appointments" && <DoctorAppointments data={data} doctor={doctor} setData={setData} notify={notify} />}
      {active === "prescriptions" && <DoctorPrescriptions data={data} doctor={doctor} setData={setData} notify={notify} />}
      {active === "notes" && <DoctorNotes data={data} doctor={doctor} setData={setData} notify={notify} />}
      {active === "settings" && <DoctorSettings doctor={doctor} />}
    </PortalShell>
  );
}

function PortalShell({ nav, active, setActive, children, theme, setTheme, logout, mobileNav, setMobileNav, notificationCount = 0, notifications = [], markNotificationsRead = () => {}, language, setLanguage }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  return (
    <div className={`dashboard-page ${mobileNav ? "nav-open" : ""}`}>
      <aside className="sidebar">
        <Brand />
        <nav className="side-nav">
          {nav.map(([key, Icon, label]) => (
            <button key={key} className={active === key ? "active" : ""} onClick={() => { setActive(key); setMobileNav(false); }}><Icon size={18} /> {tx(label, language)}</button>
          ))}
        </nav>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Open navigation"><Menu /></button>
          <div className="search-wrap"><Search size={18} /><input placeholder="Search HealthLink records..." /></div>
          <div className="top-actions">
            <LanguageSelect language={language} setLanguage={setLanguage} />
            <ThemeButton theme={theme} setTheme={setTheme} />
            <div className="notification-wrap"><button className="icon-btn notification-btn" aria-label={tx("Notifications", language)} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell />{notificationCount > 0 && <span>{notificationCount}</span>}</button>{notificationsOpen && <div className="notification-panel"><div className="notification-heading"><strong>{tx("Notifications", language)}</strong><button onClick={markNotificationsRead}>{tx("Mark all as read", language)}</button></div>{notifications.length ? notifications.slice(0, 6).map((item) => <article className={item.read ? "notification-item read" : "notification-item"} key={item.id}><span className="notification-icon"><BellRing size={15} /></span><p>{tx(item.text, language)}<small>{item.read ? "Read" : "New"}</small></p></article>) : <p className="empty-notifications">{tx("No new notifications", language)}</p>}</div>}</div>
            <button className="btn secondary" onClick={logout}><LogOut size={18} /> Logout</button>
          </div>
        </header>
        <section className="workspace">{children}</section>
      </main>
    </div>
  );
}

function PatientOverview({ data, patient }) {
  const bmi = calculateBmi(patient);
  const appointment = data.appointments.find((item) => item.patientId === patient.patientId && ["Confirmed", "Pending"].includes(item.status));
  const reminder = data.reminders.find((item) => item.patientId === patient.patientId && !item.taken);
  return (
    <>
      <SectionTitle eyebrow="Patient portal" title={`Good Morning, ${patient.name.split(" ")[0]}`} subtitle="Your Health. Your History. Your Care." />
      <section className="panel profile-strip">
        <img className="avatar" src={patient.photo} alt={`${patient.name} profile`} />
        <div><h2>{patient.name}</h2><p className="muted">{patient.patientId} • {patient.age} yrs • {patient.gender} • Blood {patient.bloodGroup}</p></div>
        <Badge tone={patient.doctorAccess ? "ok" : "warn"}>{patient.doctorAccess ? "Doctor access enabled" : "Access restricted"}</Badge>
      </section>
      <section className="metrics-grid mt">
        <Metric icon={<HeartPulse />} label="Heart Rate" value="76 bpm" status="Normal" />
        <Metric icon={<Activity />} label="Blood Pressure" value="118/78" status="Normal" />
        <Metric icon={<Activity />} label="Blood Sugar" value="96 mg/dL" status="Normal" />
        <Metric icon={<Activity />} label="SpO2" value="98%" status="Normal" />
        <Metric icon={<Activity />} label="Temperature" value="98.4 F" status="Normal" />
        <Metric icon={<Activity />} label="BMI" value={bmi.value} status={bmi.category} tone={bmi.category === "Normal" ? "ok" : "warn"} />
      </section>
      <section className="card-grid mt">
        <InfoCard title="Upcoming Appointment" icon={<CalendarCheck />}>{appointment ? `${appointment.doctor} on ${appointment.date} at ${appointment.time}` : "No upcoming appointment."}</InfoCard>
        <InfoCard title="Medication Reminder" icon={<Pill />}>{reminder ? `${reminder.medicine} at ${reminder.time}` : "No pending medicine today."}</InfoCard>
        <InfoCard title="Recent Report" icon={<FileHeart />}>{data.reports.find((item) => item.patientId === patient.patientId)?.name || "No report uploaded."}</InfoCard>
        <InfoCard title="MediAI Insight" icon={<Bot />}>Your profile contains a reminder scheduled for {reminder?.time || "today"}. Educational only.</InfoCard>
      </section>
      <YogaSuggestion patient={patient} />
      <section className="card-grid mt">
        <article className="panel"><h3>Health Overview Score</h3><div className="score-ring"><span>78</span></div><p className="muted">Wellness score, not a diagnosis or clinical score.</p></article>
        <article className="panel health-id-card"><h3>My Health ID</h3><div className="real-qr"><QRCodeSVG value={`${patient.patientId}|${patient.accessCode}`} size={132} level="M" includeMargin /></div><p><strong>{patient.patientId}</strong></p><p className="muted">QR and access code are demo credentials. Share only with a provider you trust.</p><div className="access-code-inline"><span>ACCESS CODE</span><strong>{patient.accessCode}</strong></div></article>
      </section>
    </>
  );
}

function YogaSuggestion({ patient }) {
  const conditions = (patient.conditions || []).join(" ").toLowerCase();
  let suggestion = "Gentle mobility and a short relaxation practice in a comfortable, temperature-controlled space.";
  let note = "Start gently, use a qualified instructor, and stop if you feel unwell. Ask your clinician what is appropriate for you.";
  let source = "https://www.nccih.nih.gov/health/yoga-effectiveness-and-safety";
  let sourceLabel = "NCCIH: Yoga effectiveness & safety";
  if (conditions.includes("asthma")) {
    suggestion = "Consider gentle, low-intensity movement and relaxation with comfortable, natural breathing. Avoid breath-holding or forceful breathing unless your clinician has specifically guided you.";
    note = "Yoga must not replace asthma medicines or your care plan. Ask your clinician before adding it.";
    source = "https://www.nccih.nih.gov/health/asthma-and-complementary-health-approaches-what-you-need-to-know";
    sourceLabel = "NCCIH: Asthma & complementary approaches";
  } else if (conditions.includes("hypertension") || conditions.includes("blood pressure")) {
    suggestion = "A gentle, instructor-led relaxation or mobility session may be a starting point. Some yoga poses may need to be modified or avoided with high blood pressure.";
    note = "Discuss your blood-pressure history and suitable poses with your clinician and qualified instructor first.";
    source = "https://www.nccih.nih.gov/health/hypertension-high-blood-pressure";
    sourceLabel = "NCCIH: High blood pressure";
  } else if (conditions.includes("migraine") || conditions.includes("headache")) {
    suggestion = "On a comfortable day, consider a short, quiet relaxation or gentle mobility session. Research is still limited, so use it as general wellness support only.";
    source = "https://www.nccih.nih.gov/health/yoga-effectiveness-and-safety";
    sourceLabel = "NCCIH: Yoga evidence";
  } else if (conditions.includes("allerg")) {
    suggestion = "If you choose to move, try a clean, low-trigger indoor space and gentle stretching at your own pace.";
    note = "Stop if symptoms start or worsen, and follow your clinician's allergy plan.";
  }
  return <section className="yoga-suggestion panel"><div className="yoga-card-icon"><PersonStanding size={22} /></div><div className="yoga-card-content"><p className="eyebrow">YOGA & WELLNESS · PERSONALIZED FROM YOUR PROFILE</p><h3>A gentle idea for today</h3><p>{suggestion}</p><small>{note}</small><a href={source} target="_blank" rel="noreferrer">{sourceLabel} <ArrowUpRight size={13} /></a></div><div className="yoga-duration"><span>START SMALL</span><strong>5–10</strong><small>minutes</small></div></section>;
}

function DoctorDirectory({ data, setData, notify }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [maxFee, setMaxFee] = useState("2000");
  const [specialty, setSpecialty] = useState("All specialties");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const doctors = data.doctors.filter((doctor) => {
    const matchesText = `${doctor.name} ${doctor.specialization} ${doctor.hospital} ${doctor.city || ""} ${doctor.country || "India"}`.toLowerCase().includes(query.toLowerCase());
    const matchesCity = !city || `${doctor.city || ""} ${doctor.country || "India"}`.toLowerCase().includes(city.toLowerCase());
    const matchesSpecialty = specialty === "All specialties" || doctor.specialization === specialty;
    return matchesText && matchesCity && matchesSpecialty && Number(doctor.fee || 800) <= Number(maxFee);
  });
  const requestVisit = (event) => {
    event.preventDefault();
    if (!selectedDoctor || !date || !time) return notify("Choose a doctor, date and time to continue.");
    const patient = data.patients.find((item) => item.patientId === loadSession()?.id);
    if (!patient) return notify("Sign in to a patient account to request an appointment.");
    const appointment = { id: newId("A"), patientId: patient.patientId, doctorId: selectedDoctor.doctorId, doctor: selectedDoctor.name, specialization: selectedDoctor.specialization, date, time, status: "Pending", consultationType: "Virtual" };
    setData((current) => ({ ...current, appointments: [...current.appointments, appointment], notifications: [{ id: newId("N"), userId: patient.patientId, text: `Your appointment request with ${selectedDoctor.name} was sent.`, read: false }, { id: newId("N"), userId: selectedDoctor.doctorId, text: `New appointment request from ${patient.name} for ${date}.`, read: false }, ...current.notifications] }));
    setSelectedDoctor(null);
    notify("Appointment request sent. The provider must confirm it.");
  };
  const specialties = ["All specialties", ...new Set(data.doctors.map((doctor) => doctor.specialization))];
  return <><SectionTitle eyebrow="HEALTHLINK DOCTOR NETWORK" title="Care without borders." subtitle="Discover demo providers, compare consultation fees and choose a care option that fits your budget." />
    <section className="directory-search panel"><div className="directory-intro"><div className="directory-globe"><MapPin size={22} /></div><div><h2>Find the right doctor, wherever you are.</h2><p>Search providers by location, specialty and consultation budget.</p></div></div><div className="directory-filters"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Doctor, specialty, hospital" /></label><label><MapPin size={16} /><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City or country" /></label><label><Stethoscope size={16} /><select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>{specialties.map((value) => <option key={value}>{value}</option>)}</select></label><label className="budget-filter"><span>Max fee ₹</span><input type="number" min="0" max="50000" value={maxFee} onChange={(event) => setMaxFee(event.target.value)} /></label></div><div className="directory-trust"><ShieldCheck size={15} /> Compare sample provider profiles and fees. Verify credentials and availability before booking in a live service.</div></section>
    <div className="directory-heading"><div><p className="eyebrow">{doctors.length} PROVIDERS FOUND</p><h2>Recommended doctors</h2></div><span className="virtual-badge"><Video size={14} /> Virtual & in-person options</span></div>
    <section className="doctor-directory-grid">{doctors.length ? doctors.map((doctor) => <article className="doctor-directory-card panel" key={doctor.doctorId}><div className="doctor-card-top"><img src={doctor.photo} alt={doctor.name} /><span className="rating-pill">★ {doctor.rating || "4.8"}</span></div><p className="eyebrow">{doctor.specialization}</p><h3>{doctor.name}</h3><p className="muted">{doctor.experience} experience · {doctor.hospital}</p><div className="doctor-meta"><span><MapPin size={14} />{doctor.city || "India"}, {doctor.country || "India"}</span><span><User size={14} />{(doctor.languages || ["English"]).join(", ")}</span></div><div className="doctor-fee"><span>Consultation from</span><strong>₹{doctor.fee || 800}</strong></div><button className="btn primary full" onClick={() => setSelectedDoctor(doctor)}>Request appointment <ArrowRight size={15} /></button></article>) : <div className="panel empty-state">No providers match those filters. Try another specialty, city or budget.</div>}</section>
    {selectedDoctor && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedDoctor(null)}><section className="booking-modal panel" role="dialog" aria-modal="true" aria-labelledby="booking-title" onClick={(event) => event.stopPropagation()}><button className="modal-close icon-btn" aria-label="Close" onClick={() => setSelectedDoctor(null)}>×</button><p className="eyebrow">REQUEST A VISIT</p><h2 id="booking-title">{selectedDoctor.name}</h2><p className="muted">{selectedDoctor.specialization} · estimated fee ₹{selectedDoctor.fee || 800}</p><form className="form-grid" onSubmit={requestVisit}><Field label="Date" type="date" value={date} onChange={setDate} required /><Field label="Time" type="time" value={time} onChange={setTime} required /><div className="wide modal-actions"><button type="button" className="btn secondary" onClick={() => setSelectedDoctor(null)}>Cancel</button><button className="btn primary">Send request</button></div></form><p className="muted">Your request is pending provider confirmation. No payment is taken here.</p></section></div>}
  </>;
}

function PatientProfile({ patient, setData, notify }) {
  const [form, setForm] = useState(patient);
  const [photoError, setPhotoError] = useState("");
  const updatePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoError("Choose an image file."); return; }
    if (file.size > 1024 * 1024) { setPhotoError("Choose an image under 1 MB for this browser demo."); return; }
    const reader = new FileReader();
    reader.onload = () => { setForm((current) => ({ ...current, photo: reader.result })); setPhotoError(""); };
    reader.readAsDataURL(file);
  };
  const save = (event) => {
    event.preventDefault();
    if (!form.name?.trim() || !form.email?.trim() || !form.phone?.trim() || !form.bloodGroup) return notify("Complete the required profile fields before saving.");
    setData((data) => ({ ...data, patients: data.patients.map((item) => item.patientId === patient.patientId ? { ...item, ...form, age: Number(form.age), height: Number(form.height), weight: Number(form.weight) } : item) }));
    notify("Profile saved.");
  };
  return (
    <>
      <SectionTitle eyebrow="Patient portal" title="Patient Profile" />
      <form className="panel form-grid" onSubmit={save}>
        <div className="wide profile-strip"><div className="profile-photo-control"><img className="avatar" src={form.photo || patient.photo} alt={`${patient.name} profile`} /><label className="photo-upload"><Upload size={14} /> Change photo<input type="file" accept="image/*" onChange={updatePhoto} /></label></div><div><h2>{patient.name}</h2><p className="muted">{patient.patientId}</p>{photoError && <p className="field-error">{photoError}</p>}</div></div>
        {[["name", "text", true], ["email", "email", true], ["phone", "tel", true], ["age", "number", true], ["height", "number", false], ["weight", "number", false], ["emergencyContact", "tel", true]].map(([key, type, required]) => <Field key={key} label={labelize(key)} type={type} value={form[key]} required={required} onChange={(value) => setForm({ ...form, [key]: value })} />)}
        <Select label="Blood Group" value={form.bloodGroup} onChange={(value) => setForm({ ...form, bloodGroup: value })} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
        <TextArea label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} required wide />
        <button className="btn primary wide">Save Profile</button>
      </form>
    </>
  );
}

function MedicalHistory({ data, patient, setData, notify }) {
  const visits = data.visits.filter((item) => item.patientId === patient.patientId);
  const addVisit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("document");
    if (file?.size > 10 * 1024 * 1024) return notify("Choose a document no larger than 10 MB.");
    let uploadedDocument = null;
    try {
      if (file?.name) {
        const allowedTypes = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]);
        if (!allowedTypes.has(file.type)) return notify("Choose a PDF, Word document, PNG or JPEG file.");
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read the selected file."));
          reader.readAsDataURL(file);
        });
        uploadedDocument = await healthLinkApi.uploadMedicalHistoryDocument({
          fileName: file.name,
          mimeType: file.type,
          dataBase64: String(dataUrl).split(",")[1]
        });
      }
      const date = form.get("date");
      const day = new Date(`${date}T12:00:00`).toLocaleDateString("en", { weekday: "long" });
      const visit = {
        id: newId("V"), patientId: patient.patientId, date, day, time: form.get("time"),
        hospital: form.get("hospital"), reason: form.get("reason"), doctor: form.get("doctor"),
        treatment: form.get("treatment"), documentId: uploadedDocument?.id, documentName: uploadedDocument?.fileName
      };
      setData((current) => ({
        ...current,
        visits: [visit, ...current.visits],
        reports: uploadedDocument ? [{ id: newId("R"), patientId: patient.patientId, name: uploadedDocument.fileName, fileId: uploadedDocument.id, type: "Visit document", date, uploadedBy: "Patient" }, ...current.reports] : current.reports
      }));
      formElement.reset();
      notify(uploadedDocument ? "Visit and document saved. Use Download document to retrieve it later." : "Visit details added to your history.");
    } catch (error) {
      notify(error.message || "Could not save the document.");
    }
  };
  const addItem = (key) => {
    const value = prompt(`Add ${labelize(key)}`);
    if (!value) return;
    setData((current) => ({ ...current, patients: current.patients.map((item) => item.patientId === patient.patientId ? { ...item, [key]: [...item[key], value] } : item) }));
    notify("Medical history updated.");
  };
  const removeItem = (key, index) => {
    setData((current) => ({ ...current, patients: current.patients.map((item) => item.patientId === patient.patientId ? { ...item, [key]: item[key].filter((_, i) => i !== index) } : item) }));
  };
  return (
    <>
      <SectionTitle eyebrow="Patient portal" title="Medical History" subtitle="Manage conditions, allergies, surgeries, visits and family records." />
      <section className="card-grid">
        {["conditions", "allergies", "surgeries"].map((key) => (
          <article className="panel" key={key}>
            <h3>{labelize(key)}</h3>
            {patient[key].map((item, index) => <p key={`${item}-${index}`}><Badge>{item}</Badge> <button className="mini-btn" onClick={() => removeItem(key, index)}>Delete</button></p>)}
            <button className="btn secondary" onClick={() => addItem(key)}><Plus size={16} /> Add</button>
          </article>
        ))}
      </section>
      <form className="panel mt visit-history-form" onSubmit={addVisit}><h3>Add a visit or medical document</h3><p className="muted">Demo files up to 10 MB are stored with your visit. Do not upload real patient records.</p><div className="form-grid"><label>Date<input name="date" type="date" required /></label><label>Time<input name="time" type="time" required /></label><label>Doctor<input name="doctor" required placeholder="Doctor name" /></label><label>Hospital or clinic<input name="hospital" required placeholder="Facility name" /></label><label className="wide">Problem or reason for visit<input name="reason" required placeholder="What was the visit for?" /></label><label className="wide">Treatment or notes<input name="treatment" placeholder="Optional summary" /></label><label className="wide">Attach report or visit document<input name="document" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" /></label><button className="btn primary wide">Save to Medical History</button></div></form>
      <section className="panel mt"><h3>Previous Hospital Visits</h3><div className="timeline">{visits.map((visit) => <article className="timeline-card" key={visit.id || `${visit.date}-${visit.reason}`}><strong>{visit.day || new Date(`${visit.date}T12:00:00`).toLocaleDateString("en", { weekday: "long" })} · {visit.date} {visit.time && `· ${visit.time}`} · {visit.hospital}</strong><p>Reason: {visit.reason} • Doctor: {visit.doctor}</p><p className="muted">{visit.treatment}</p>{visit.documentId && <p><a className="btn secondary" href={healthLinkApi.medicalHistoryDocumentUrl(visit.documentId)}>Download document: {visit.documentName}</a></p>}</article>)}</div></section>
      <section className="panel mt"><h3>Family Medical History</h3><p>{patient.familyHistory}</p></section>
    </>
  );
}

function PatientAppointments({ data, patient, setData, notify }) {
  const [form, setForm] = useState({ doctorId: data.doctors[0]?.doctorId || "", date: "", time: "" });
  const appointments = data.appointments.filter((item) => item.patientId === patient.patientId);
  const book = (event) => {
    event.preventDefault();
    const doctor = data.doctors.find((item) => item.doctorId === form.doctorId);
    if (!doctor) return notify("Choose a doctor before booking.");
    const appointment = { id: newId("A"), patientId: patient.patientId, doctorId: doctor.doctorId, doctor: doctor.name, specialization: doctor.specialization, date: form.date, time: form.time, status: "Pending" };
    setData((current) => ({ ...current, appointments: [...current.appointments, appointment], notifications: [{ id: newId("N"), userId: doctor.doctorId, text: `New appointment request from ${patient.name} for ${form.date}.`, read: false }, ...current.notifications] }));
    notify("Appointment request booked.");
  };
  const updateStatus = (id, status) => {
    const appointment = appointments.find((item) => item.id === id);
    setData((current) => ({ ...current, appointments: current.appointments.map((item) => item.id === id ? { ...item, status } : item), notifications: [{ id: newId("N"), userId: patient.patientId, text: `Your appointment with ${appointment?.doctor || "your doctor"} was ${status.toLowerCase()}.`, read: false }, ...current.notifications] }));
    notify(`Appointment ${status.toLowerCase()}.`);
  };
  return (
    <>
      <SectionTitle eyebrow="Patient portal" title="Appointments" />
      <form className="panel form-grid" onSubmit={book}>
        <Select label="Doctor" value={form.doctorId} onChange={(value) => setForm({ ...form, doctorId: value })} options={data.doctors.map((doctor) => ({ value: doctor.doctorId, label: `${doctor.name} - ${doctor.specialization}` }))} required />
        <Field label="Date" type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} required />
        <Field label="Time" type="time" value={form.time} onChange={(value) => setForm({ ...form, time: value })} required />
        <button className="btn primary">Book Appointment</button>
      </form>
      <DataTable className="mt" columns={["Doctor", "Specialization", "Date", "Time", "Status", "Action"]} rows={appointments.map((item) => [item.doctor, item.specialization, item.date, item.time, <Badge>{item.status}</Badge>, <button className="mini-btn" onClick={() => updateStatus(item.id, "Cancelled")}>Cancel</button>])} />
    </>
  );
}

function Reports({ data, patient, setData, notify }) {
  const reports = data.reports.filter((item) => item.patientId === patient.patientId);
  const upload = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!file?.name) return notify("Please choose a report file.");
    if (file.size > 10 * 1024 * 1024) return notify("Choose a report no larger than 10 MB.");
    const allowedTypes = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]);
    if (!allowedTypes.has(file.type)) return notify("Upload a PDF, Word document, PNG or JPEG report.");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the selected report."));
        reader.readAsDataURL(file);
      });
      const savedFile = await healthLinkApi.uploadMedicalHistoryDocument({
        fileName: file.name,
        mimeType: file.type,
        dataBase64: String(dataUrl).split(",")[1]
      });
      const report = { id: newId("R"), patientId: patient.patientId, name: savedFile.fileName, fileId: savedFile.id, type: form.get("type"), date: new Date().toISOString().slice(0, 10), uploadedBy: "Patient" };
      setData((current) => ({ ...current, reports: [report, ...current.reports] }));
      formElement.reset();
      notify("Report file saved. Use Download report to retrieve it later.");
    } catch (error) {
      notify(error.message || "Could not save the report file.");
    }
  };
  return (
    <>
      <SectionTitle eyebrow="Patient portal" title="Medical Reports" subtitle="Demo files up to 10 MB are stored with their report details. Do not upload real patient records." />
      <form className="panel form-grid" onSubmit={upload}>
        <Select label="Report Type" name="type" options={["Blood Test", "X-Ray", "MRI", "CT Scan", "Prescription", "Health Report", "Other Documents"]} />
        <label>File<input name="file" type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" required /></label>
        <button className="btn primary"><Upload size={18} /> Upload Report</button>
      </form>
      <section className="card-grid mt">{reports.map((report) => <article className="panel" key={report.id}><h3>{report.name}</h3><p>{report.type} • {report.date}</p><p className="muted">Uploaded by {report.uploadedBy}</p>{report.fileId && <a className="btn secondary" href={healthLinkApi.medicalHistoryDocumentUrl(report.fileId)}>Download report</a>}</article>)}</section>
    </>
  );
}
function Prescriptions({ data, patient, setData, notify }) {
  const prescriptions = data.prescriptions.filter((item) => item.patientId === patient.patientId);
  const files = (data.prescriptionFiles || []).filter((item) => item.patientId === patient.patientId);
  const upload = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const file = new FormData(formElement).get("prescriptionFile");
    if (!file?.name) return notify("Choose a prescription file first.");
    if (file.size > 10 * 1024 * 1024) return notify("Choose a file no larger than 10 MB.");
    const allowedTypes = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"]);
    if (!allowedTypes.has(file.type)) return notify("Upload a PDF, Word document, PNG or JPEG file.");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the selected file."));
        reader.readAsDataURL(file);
      });
      const savedFile = await healthLinkApi.uploadMedicalHistoryDocument({
        fileName: file.name,
        mimeType: file.type,
        dataBase64: String(dataUrl).split(",")[1]
      });
      const item = { id: newId("RXF"), fileId: savedFile.id, patientId: patient.patientId, name: savedFile.fileName, date: new Date().toISOString().slice(0, 10), uploadedBy: "Patient" };
      setData((current) => ({ ...current, prescriptionFiles: [item, ...(current.prescriptionFiles || [])] }));
      formElement.reset();
      notify("Prescription file saved. Use Download prescription to retrieve it later.");
    } catch (error) {
      notify(error.message || "Could not save the prescription file.");
    }
  };
  return <><SectionTitle eyebrow="Patient portal" title="Prescriptions" /><form className="panel form-grid prescription-upload" onSubmit={upload}><div className="wide"><h3>Upload a written prescription</h3><p className="muted">Demo files up to 10 MB are stored with the prescription. Do not upload real patient records.</p></div><label className="wide">Prescription file<input name="prescriptionFile" type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" required /></label><button className="btn primary wide"><Upload size={17} /> Save prescription file</button></form>{files.length > 0 && <section className="card-grid mt">{files.map((file) => <article className="panel" key={file.id}><h3>{file.name}</h3><p>Uploaded {file.date}</p><Badge>{file.uploadedBy}</Badge>{file.fileId && <p><a className="btn secondary" href={healthLinkApi.medicalHistoryDocumentUrl(file.fileId)}>Download prescription</a></p>}</article>)}</section>}<section className="card-grid mt">{prescriptions.map((rx) => <PrescriptionCard key={rx.id} rx={rx} />)}</section></>;
}
function Analytics() {
  const baseCharts = [
    ["Weight Progress", [72, 71.8, 71.6, 71.4, 71.1, 70.9]],
    ["Blood Pressure", [118, 120, 119, 121, 117, 118]],
    ["Blood Sugar", [98, 96, 97, 95, 94, 96]],
    ["Heart Rate", [78, 76, 77, 75, 74, 76]],
    ["Sleep Hours", [6, 7, 6.5, 7.2, 8, 7.5]],
    ["Water Intake", [2, 2.2, 2.1, 2.4, 2.5, 2.6]]
  ];
  const [charts, setCharts] = useState(baseCharts);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [isLive, setIsLive] = useState(true);
  useEffect(() => {
    if (!isLive) return undefined;
    const timer = setInterval(() => {
      setCharts((current) => current.map(([title, values], index) => {
        const last = values.at(-1);
        const step = index === 0 ? 0.2 : index === 4 || index === 5 ? 0.2 : 1;
        const next = Math.max(0, Number((last + (Math.random() - 0.5) * step).toFixed(1)));
        return [title, [...values.slice(1), next]];
      }));
      setUpdatedAt(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, [isLive]);
  return (
    <>
      <SectionTitle eyebrow="Patient portal" title="Health Analytics" subtitle="A live-style view of your health trends. Sample values update in this demo and are not medical measurements." />
      <div className="analytics-livebar"><span className={`live-pulse ${isLive ? "on" : ""}`} /><strong>{isLive ? "Live demo stream" : "Stream paused"}</strong><span>Last refresh {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span><button className="mini-btn" onClick={() => setIsLive((current) => !current)}>{isLive ? "Pause" : "Resume"}</button></div>
      <section className="chart-grid">{charts.map(([title, values]) => <MiniChart key={title} title={title} values={values} />)}</section>
      <section className="panel mt analytics-disclaimer"><ShieldCheck size={18} /><p><strong>Demo stream only.</strong> No wearable or clinical device is connected. Do not use these changing sample charts to make healthcare decisions.</p></section>
    </>
  );
}

function offlineWellnessReply(question) {
  const q = question.toLowerCase();
  if (/headache|head pain|migraine/.test(q)) return `Headache: Rest somewhere quiet, drink water if you may be dehydrated, and note when it began and any other symptoms. Seek emergency care for a sudden, extremely severe headache, weakness or numbness, confusion, trouble speaking, fainting, vision loss, fever with a stiff neck, or a headache after a head injury. For a new, recurring, worsening, or concerning headache, contact a clinician. I can’t diagnose the cause.`;
  if (/hair|hairfall|hair fall|shedding/.test(q)) return `Hair shedding can have many causes, including recent illness or stress, medicines, nutrition, or scalp conditions. Avoid tight hairstyles and harsh treatments, and note when it began and whether it is patchy or widespread. See a clinician or dermatologist if it is sudden, patchy, persistent, or accompanied by scalp pain, redness, or scaling. Don’t start supplements without checking with a clinician.`;
  if (/skin|glow|acne|pimple/.test(q)) return `For a simple skin-care routine, use a gentle cleanser, moisturizer, and broad-spectrum sunscreen during the day. Add products one at a time and stop if they irritate your skin. “Glow” products can’t guarantee a result. Ask a dermatologist about a persistent rash, painful acne, or changing mole.`;
  if (/weight|gain|lose|bmi/.test(q)) return `Weight changes can relate to many factors, and BMI alone doesn’t explain the cause. If weight gain is unexpected, rapid, persistent, or accompanied by swelling, shortness of breath, or other new symptoms, arrange medical advice. Consider tracking changes and discussing sleep, activity, diet, medicines, and health conditions with a clinician. Avoid crash diets or restrictive plans.`;
  if (/diet|food|meal|nutrition|eat/.test(q)) return `General meal idea: include vegetables or fruit, a source of protein, and a high-fiber grain or starchy food; drink water and adapt choices to your allergies, conditions, culture, and preferences. This app has not analyzed your reports or demo charts, so this is not a personalized diet plan. A clinician or registered dietitian can tailor advice to your health needs.`;
  if (/medicine|medication|dose|prescription/.test(q)) return `I can’t recommend starting, stopping, or changing a medicine or dose. Follow your prescription and ask your doctor or pharmacist about side effects, timing, or missed doses. If you may be having a severe reaction, seek urgent medical help.`;
  if (/stress|sleep|exercise|lifestyle|wellness/.test(q)) return `General wellness basics include a regular sleep schedule, comfortable movement you can do safely, balanced meals, hydration, and keeping routine appointments. Start gradually and adapt to your health needs. If a symptom is new, persistent, or worsening, discuss it with a clinician.`;
  return `I’m the free offline MediAI guide, so I can offer general information for common questions about headaches, hair shedding, skin care, weight changes, food, medicines, sleep, and activity. I don’t diagnose, read uploaded reports, or interpret the demo analytics. Tell me which topic you’d like help with, or speak with a clinician for personal medical advice.`;
}

function Assistant() {
  const [messages, setMessages] = useState([{ from: "ai", text: "Hi, I’m MediAI, the free offline wellness guide. Your messages stay in this app and are not sent to an AI provider. I can share general information, but I cannot diagnose, interpret uploaded reports, or replace a clinician." }]);
  const [text, setText] = useState("");
  const prompts = ["I’m gaining weight. What should I discuss with my clinician?", "Why might hair be falling out?", "What are basic steps for a simple skin-care routine?", "I have a headache. What warning signs should I watch for?", "Suggest general balanced-meal ideas"];
  const ask = (prompt) => {
    if (!prompt.trim()) return;
    const answer = offlineWellnessReply(prompt.trim());
    setMessages((items) => [...items, { from: "user", text: prompt.trim() }, { from: "ai", text: answer }]);
    setText("");
  };
  return (
    <>
      <SectionTitle eyebrow="MediAI" title="Free Offline Wellness Guide" subtitle="Curated general health information. No API key, provider connection, or usage fees." />
      <section className="panel">
        <div className="assistant-chat" aria-live="polite">{messages.map((message, index) => <div className={`msg ${message.from === "user" ? "user" : ""}`} key={index}>{message.text}</div>)}</div>
        <form className="form-row mt" onSubmit={(event) => { event.preventDefault(); ask(text); }}>
          <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask about common wellness topics…" maxLength={500} />
          <button className="btn primary" disabled={!text.trim()}>Send</button>
        </form>
        <div className="actions mt">{prompts.map((prompt) => <button className="mini-btn" type="button" key={prompt} onClick={() => ask(prompt)}>{prompt}</button>)}</div>
        <p className="muted mt">This offline guide does not send or store your chat with an AI provider. It does not analyze uploaded files or demo health charts, and it is not medical diagnosis or treatment. For urgent or severe symptoms, contact emergency services or a clinician.</p>
      </section>
    </>
  );
}
function Reminders({ data, patient, setData, notify }) {
  const [form, setForm] = useState({ medicine: "", time: "", time2: "", dosage: "", frequency: "Once daily" });
  const reminders = data.reminders.filter((item) => item.patientId === patient.patientId);
  const add = (event) => {
    event.preventDefault();
    const reminder = { id: newId("M"), patientId: patient.patientId, ...form, taken: false };
    setData((current) => ({ ...current, reminders: [...current.reminders, reminder], notifications: [{ id: newId("N"), userId: patient.patientId, text: `Medication reminder added for ${form.medicine} at ${form.time}.`, read: false }, ...current.notifications] }));
    setForm({ medicine: "", time: "", time2: "", dosage: "", frequency: "Once daily" });
    notify("Medication reminder added.");
  };
  const markTaken = (id) => setData((current) => ({ ...current, reminders: current.reminders.map((item) => item.id === id ? { ...item, taken: true } : item) }));
  return (
    <>
      <SectionTitle eyebrow="Patient portal" title="Medication Reminders" />
      <form className="panel form-grid" onSubmit={add}>
        <Field label="Medicine or reminder" value={form.medicine} onChange={(value) => setForm({ ...form, medicine: value })} required />
        <Field label="Dose" value={form.dosage} onChange={(value) => setForm({ ...form, dosage: value })} required />
        <Select label="Frequency" value={form.frequency} onChange={(frequency) => setForm({ ...form, frequency })} options={["Once daily", "Twice a day", "Every 2 days", "Three times a day", "Weekly", "Custom schedule"]} />
        <Field label={form.frequency === "Twice a day" || form.frequency === "Three times a day" ? "First dose time" : "Reminder time"} type="time" value={form.time} onChange={(time) => setForm({ ...form, time })} required />
        {(form.frequency === "Twice a day" || form.frequency === "Three times a day") && <Field label="Second dose time" type="time" value={form.time2} onChange={(time2) => setForm({ ...form, time2 })} required />}
        {form.frequency === "Three times a day" && <Field label="Third dose time" type="time" value={form.time3 || ""} onChange={(time3) => setForm({ ...form, time3 })} required />}
        <button className="btn primary">Add Reminder</button>
      </form>
      <section className="timeline mt">{reminders.map((item) => <article className="timeline-card" key={item.id}><strong>{[item.time, item.time2, item.time3].filter(Boolean).join(", ")} - {item.medicine}</strong><p>{item.dosage} • {item.frequency}</p><Badge tone={item.taken ? "ok" : "warn"}>{item.taken ? "Taken" : "Pending"}</Badge> <button className="mini-btn" onClick={() => markTaken(item.id)}>Mark as Taken</button></article>)}</section>
    </>
  );
}

function PatientSettings({ data, patient, setData, notify }) {
  const toggleAccess = () => {
    setData((current) => ({ ...current, patients: current.patients.map((item) => item.patientId === patient.patientId ? { ...item, doctorAccess: !item.doctorAccess } : item) }));
  };
  const generate = () => {
    const accessCode = `ACCESS-${Math.floor(10000 + Math.random() * 89999)}`;
    setData((current) => ({ ...current, patients: current.patients.map((item) => item.patientId === patient.patientId ? { ...item, accessCode } : item) }));
    notify("New temporary access code generated.");
  };
  return (
    <>
      <SectionTitle eyebrow="Patient portal" title="Settings & Consent" />
      <section className="card-grid">
        <article className="panel"><h3>Medical Access</h3><div className="settings-access-qr"><QRCodeSVG value={`${patient.patientId}|${patient.accessCode}`} size={116} level="M" includeMargin /></div><p>Patient ID: <strong>{patient.patientId}</strong></p><p>Current code: <strong>{patient.accessCode}</strong></p><p className="muted">This QR contains demo credentials. A production app should use short-lived, server-verified access tokens.</p><Badge tone={patient.doctorAccess ? "ok" : "warn"}>{patient.doctorAccess ? "Doctor access allowed" : "Doctor access disabled"}</Badge><div className="actions mt"><button className="btn primary" onClick={generate}>Generate Access Code</button><button className="btn secondary" onClick={toggleAccess}>{patient.doctorAccess ? "Revoke Access" : "Grant Access"}</button></div></article>
        <article className="panel"><h3>Notifications</h3><label className="check"><input type="checkbox" defaultChecked /> Appointment notifications</label><label className="check"><input type="checkbox" defaultChecked /> Medication reminders</label><label className="check"><input type="checkbox" /> Email notifications</label></article>
        <article className="panel"><h3>Production Security</h3><p className="muted">For real patients, use secure authentication, encrypted storage, backend consent, RBAC, audit logs, and compliance review.</p></article>
      </section>
      <section className="panel mt"><h3>Access History</h3>{data.accessHistory.filter((item) => item.patientId === patient.patientId).map((item) => <p key={`${item.date}-${item.time}`}>{item.doctor} • {item.date} {item.time} • {item.type}</p>)}</section>
    </>
  );
}

function DoctorOverview({ data, doctor, setData, notify, setActive }) {
  const [search, setSearch] = useState({ patientId: "", accessCode: "" });
  const [result, setResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef(null);
  useEffect(() => {
    if (!scanning) return undefined;
    let stream;
    let frameId;
    let stopped = false;
    const stopTracks = () => stream?.getTracks().forEach((track) => track.stop());
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !("BarcodeDetector" in window)) {
          throw new Error("QR camera scanning is not supported in this browser. Enter the patient ID and code manually.");
        }
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) return stopTracks();
        const video = videoRef.current;
        if (!video) return stopTracks();
        video.srcObject = stream;
        await video.play();
        const scanFrame = async () => {
          if (stopped) return;
          try {
            const [code] = await detector.detect(video);
            if (code?.rawValue) {
              const match = code.rawValue.trim().match(/^([^|]+)\|([^|]+)$/);
              if (!match) {
                setScanError("This QR code is not a HealthLink patient access code.");
              } else {
                setSearch((current) => ({ ...current, patientId: match[1].trim(), accessCode: match[2].trim() }));
                setScanError("");
              }
              setScanning(false);
              return;
            }
          } catch {
            // Keep scanning if a frame is not ready for detection.
          }
          frameId = requestAnimationFrame(scanFrame);
        };
        scanFrame();
      } catch (error) {
        setScanError(error.message || "Could not start the camera. Check browser camera permission.");
        setScanning(false);
      }
    })();
    return () => {
      stopped = true;
      if (frameId) cancelAnimationFrame(frameId);
      stopTracks();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [scanning]);
  const verify = async (event) => {
    event.preventDefault();
    setResult(null);
    setVerifying(true);
    try {
      await healthLinkApi.verifyPatientAccess({
        patientId: search.patientId.trim(),
        accessCode: search.accessCode.trim()
      });
      const updatedPortal = await healthLinkApi.getPortal();
      const patient = updatedPortal.patients.find((item) => item.patientId === search.patientId.trim());
      if (!patient) throw new Error("Access was verified, but the patient profile could not be loaded. Please try again.");
      setData(updatedPortal);
      setResult({ patient });
      notify("Patient access verified for 30 minutes.");
    } catch (error) {
      setResult({ error: error.message || "Could not verify patient access. Check the ID, code, and backend connection." });
    } finally {
      setVerifying(false);
    }
  };
  const todaysAppointments = data.appointments.filter((item) => item.doctorId === doctor.doctorId && item.date === new Date().toISOString().slice(0, 10)).sort((a, b) => a.time.localeCompare(b.time));
  const pendingRequests = data.appointments.filter((item) => item.doctorId === doctor.doctorId && item.status === "Pending");
  return (
    <>
      <SectionTitle eyebrow="Doctor portal" title={`Welcome, ${doctor.name}`} subtitle={`${doctor.specialization} • ${doctor.experience} • ${doctor.hospital}`} />
      <section className="metrics-grid">
        <Metric icon={<User />} label="Total Patients" value={data.patients.length} status="Active" />
        <Metric icon={<CalendarCheck />} label="Appointments" value={data.appointments.filter((item) => item.doctorId === doctor.doctorId).length} status="This month" />
        <Metric icon={<FileHeart />} label="Pending Reports" value={data.reports.length} status="Review" tone="warn" />
        <Metric icon={<ClipboardList />} label="Follow-ups" value={data.appointments.filter((item) => item.status === "Pending").length} status="Pending" tone="warn" />
      </section>
      <section className="doctor-workbench-grid mt">
        <article className="panel doctor-workbench-card"><div className="workbench-card-heading"><div><p className="eyebrow">TODAY AT A GLANCE</p><h3>Clinic schedule</h3></div><button className="mini-btn" onClick={() => setActive("appointments")}>Open schedule <ArrowRight size={14} /></button></div>{todaysAppointments.length ? <div className="schedule-list">{todaysAppointments.slice(0, 4).map((item) => <div className="schedule-row" key={item.id}><span className="schedule-time">{item.time}</span><span><strong>{data.patients.find((person) => person.patientId === item.patientId)?.name || item.patientId}</strong><small>{item.specialization} · {item.status}</small></span><Badge tone={item.status === "Confirmed" ? "ok" : "warn"}>{item.status}</Badge></div>)}</div> : <p className="muted">No visits are scheduled for today. Your next patient booking will appear here.</p>}</article>
        <article className="panel doctor-workbench-card"><p className="eyebrow">CARE TEAM INBOX</p><h3>{pendingRequests.length} requests need attention</h3><p className="muted">Review appointment requests and complete follow-ups from one place.</p><button className="btn primary" onClick={() => setActive("appointments")}>Review requests <ArrowRight size={16} /></button><button className="btn secondary" onClick={() => setActive("notes")}>Add clinical note</button></article>
      </section>
      <section className="panel mt">
        <h3>Authorized Medical Access</h3>
        <div className="actions mt">
          <button className="btn secondary" type="button" disabled={scanning} onClick={() => { setScanError(""); setScanning(true); }}>Scan patient QR code</button>
        </div>
        {scanning && <div className="mt"><video ref={videoRef} autoPlay playsInline aria-label="Camera view for scanning patient access QR code" style={{ display: "block", width: "min(100%, 420px)", borderRadius: 12 }} /><button className="mini-btn mt" type="button" onClick={() => setScanning(false)}>Stop camera</button></div>}
        {scanError && <p className="badge danger mt">{scanError}</p>}
        <form className="form-row mt" onSubmit={verify}>
          <input value={search.patientId} onChange={(event) => setSearch({ ...search, patientId: event.target.value })} placeholder="Patient ID (e.g. PAT-2026-007)" aria-label="Patient ID" />
          <input value={search.accessCode} onChange={(event) => setSearch({ ...search, accessCode: event.target.value })} placeholder="Access code" aria-label="Patient access code" />
          <button className="btn primary" disabled={verifying || !search.patientId.trim() || !search.accessCode.trim()}>{verifying ? "Verifying…" : "View Profile"}</button>
        </form>
        {result?.error && <p className="badge danger mt">{result.error}{result.error.includes("Only doctors") ? " Log out, sign in with the doctor account, and close other HealthLink tabs using a patient login." : ""}</p>}
        {result?.patient && <AuthorizedPatient patient={result.patient} data={data} />}
      </section>
    </>
  );
}

function PatientTable({ data }) {
  return (
    <>
      <SectionTitle eyebrow="Doctor portal" title="Patient Table" subtitle="Professional patient list with conditions, last visit and access status." />
      <DataTable columns={["Patient ID", "Name", "Age", "Gender", "Blood", "Condition", "Last Visit", "Status"]} rows={data.patients.map((patient) => {
        const last = data.visits.find((visit) => visit.patientId === patient.patientId);
        return [patient.patientId, patient.name, patient.age, patient.gender, patient.bloodGroup, patient.conditions[0], last?.date || "No visit", <Badge tone={patient.doctorAccess ? "ok" : "warn"}>{patient.doctorAccess ? "Access ready" : "Restricted"}</Badge>];
      })} />
    </>
  );
}

function DoctorAppointments({ data, doctor, setData, notify }) {
  const rows = data.appointments.filter((item) => item.doctorId === doctor.doctorId);
  const setStatus = (id, status) => {
    const appointment = rows.find((item) => item.id === id);
    setData((current) => ({ ...current, appointments: current.appointments.map((item) => item.id === id ? { ...item, status } : item), notifications: [{ id: newId("N"), userId: appointment?.patientId, text: `Your appointment with ${doctor.name} was ${status.toLowerCase()}.`, read: false }, ...current.notifications] }));
    notify(`Appointment marked ${status}.`);
  };
  return (
    <>
      <SectionTitle eyebrow="Doctor portal" title="Appointments" />
      <DataTable columns={["Patient", "Date", "Time", "Status", "Action"]} rows={rows.map((item) => {
        const patient = data.patients.find((person) => person.patientId === item.patientId);
        return [patient?.name || item.patientId, item.date, item.time, <Badge>{item.status}</Badge>, <div className="actions"><button className="mini-btn" onClick={() => setStatus(item.id, "Confirmed")}>Accept</button><button className="mini-btn" onClick={() => setStatus(item.id, "Cancelled")}>Reject</button><button className="mini-btn" onClick={() => setStatus(item.id, "Completed")}>Complete</button></div>];
      })} />
    </>
  );
}

function DoctorPrescriptions({ data, doctor, setData, notify }) {
  const [form, setForm] = useState({ patientId: data.patients[0]?.patientId || "", medicine: "Paracetamol", dosage: "500 mg", frequency: "As prescribed", duration: "3 days", diagnosis: "General clinical notes for demonstration.", instructions: "Take after food. Follow up if symptoms continue." });
  const save = (event) => {
    event.preventDefault();
    setData((current) => ({ ...current, prescriptions: [{ id: newId("RX"), doctor: doctor.name, date: new Date().toISOString().slice(0, 10), ...form }, ...current.prescriptions] }));
    notify("Prescription created.");
  };
  return (
    <>
      <SectionTitle eyebrow="Doctor portal" title="Digital Prescription" />
      <form className="panel form-grid" onSubmit={save}>
        <Select label="Patient" value={form.patientId} onChange={(value) => setForm({ ...form, patientId: value })} options={data.patients.map((patient) => ({ value: patient.patientId, label: `${patient.name} - ${patient.patientId}` }))} />
        {["medicine", "dosage", "frequency", "duration"].map((key) => <Field key={key} label={labelize(key)} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} />)}
        <TextArea label="Diagnosis / Clinical Notes" value={form.diagnosis} onChange={(value) => setForm({ ...form, diagnosis: value })} wide />
        <TextArea label="Instructions" value={form.instructions} onChange={(value) => setForm({ ...form, instructions: value })} wide />
        <button className="btn primary wide">Create Prescription</button>
      </form>
      <section className="card-grid mt">{data.prescriptions.slice(0, 6).map((rx) => <PrescriptionCard key={rx.id} rx={rx} />)}</section>
    </>
  );
}

function DoctorNotes({ data, doctor, setData, notify }) {
  const [form, setForm] = useState({ patientId: data.patients[0]?.patientId || "", notes: "", followUp: "" });
  const save = (event) => {
    event.preventDefault();
    setData((current) => ({ ...current, notes: [{ id: newId("NOTE"), date: new Date().toISOString().slice(0, 10), doctor: doctor.name, ...form }, ...current.notes] }));
    setForm({ ...form, notes: "" });
    notify("Clinical note added.");
  };
  return (
    <>
      <SectionTitle eyebrow="Doctor portal" title="Private Clinical Notes" />
      <form className="panel form-grid" onSubmit={save}>
        <Select label="Patient" value={form.patientId} onChange={(value) => setForm({ ...form, patientId: value })} options={data.patients.map((patient) => ({ value: patient.patientId, label: `${patient.name} - ${patient.patientId}` }))} />
        <Field label="Follow-up Date" type="date" value={form.followUp} onChange={(value) => setForm({ ...form, followUp: value })} />
        <TextArea label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} wide />
        <button className="btn primary wide">Add Note</button>
      </form>
      <section className="timeline mt">{data.notes.map((note) => <article className="timeline-card" key={note.id}><strong>{note.date} • {note.patientId}</strong><p>{note.notes}</p><p className="muted">Follow-up: {note.followUp || "Not set"}</p></article>)}</section>
    </>
  );
}



function DoctorSettings({ doctor }) {
  return (
    <>
      <SectionTitle eyebrow="Doctor portal" title="Settings" />
      <section className="card-grid">
        <article className="panel"><h3>Account</h3><p>{doctor.name}</p><p className="muted">{doctor.specialization} • {doctor.hospital}</p></article>
        <article className="panel"><h3>Privacy Model</h3><p className="muted">Doctors need patient consent, patient ID and temporary access code before detailed records appear.</p></article>
        <article className="panel"><h3>Live Project Checklist</h3><p className="muted">Add backend auth, audit trails, consent lifecycle, encryption, secure uploads, monitoring and legal review.</p></article>
      </section>
    </>
  );
}

function AuthorizedPatient({ patient, data }) {
  const bmi = calculateBmi(patient);
  const reports = data.reports.filter((item) => item.patientId === patient.patientId).slice(0, 3);
  return (
    <section className="authorized-card mt">
      <div className="profile-strip"><img className="avatar" src={patient.photo} alt={patient.name} /><div><p className="eyebrow">Authorized Medical Access</p><h2>{patient.name}</h2><p className="muted">{patient.patientId} • {patient.age} yrs • {patient.gender} • {patient.bloodGroup}</p></div><Badge tone="ok">BMI {bmi.value}</Badge></div>
      <div className="card-grid mt"><InfoCard title="Allergies">{patient.allergies.join(", ")}</InfoCard><InfoCard title="Existing Conditions">{patient.conditions.join(", ")}</InfoCard><InfoCard title="Medications">{patient.medications.join(", ")}</InfoCard></div>
      <h3>Previous Reports</h3>{reports.map((report) => <p key={report.id}>{report.date} • {report.type} • {report.name}</p>)}
    </section>
  );
}

function printPrescription(event) {
  const card = event.currentTarget.closest(".prescription-card");
  if (!card) return;
  const cleanup = () => {
    document.body.classList.remove("print-prescription");
    card.classList.remove("print-target");
  };
  card.classList.add("print-target");
  document.body.classList.add("print-prescription");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
}
function PrescriptionCard({ rx }) {
  return <article className="panel prescription-card"><h3>{rx.medicine}</h3><p className="muted">{rx.patientId} • {rx.doctor} • {rx.date}</p><p><strong>Notes:</strong> {rx.diagnosis}</p><p>{rx.dosage} • {rx.frequency} • {rx.duration}</p><p>{rx.instructions}</p><button className="btn secondary no-print" onClick={printPrescription}>Print Prescription</button></article>;
}

function MiniChart({ title, values }) {
  const max = Math.max(...values);
  return <article className="panel chart-box"><h3>{title}</h3><div className="bar-chart">{values.map((value, index) => <span key={index} style={{ height: `${(value / max) * 88}%` }} title={`${value}`} />)}</div></article>;
}

function DataTable({ columns, rows, className = "" }) {
  return <div className={`table-wrap ${className}`}><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function Field({ label, value, onChange, type = "text", required = false, placeholder = "", min, max, minLength, maxLength, name, accept }) {
  const language = useLanguage();
  return <label>{tx(label, language)}<input name={name} type={type} value={value ?? ""} required={required} min={min} max={max} minLength={minLength} maxLength={maxLength} accept={accept} placeholder={tx(placeholder, language)} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange, wide = false, required = false }) {
  const language = useLanguage();
  return <label className={wide ? "wide" : ""}>{tx(label, language)}<textarea value={value ?? ""} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options, name, required = false }) {
  const language = useLanguage();
  const normalized = options.map((item) => typeof item === "string" ? { value: item, label: item } : item);
  return <label>{tx(label, language)}<select name={name} required={required} value={value} onChange={(event) => onChange?.(event.target.value)}>{normalized.map((item) => <option key={item.value} value={item.value}>{tx(item.label, language)}</option>)}</select></label>;
}

function SectionTitle({ eyebrow, title, subtitle }) {
  const language = useLanguage();
  return <div className="section-heading"><p className="eyebrow">{tx(eyebrow, language)}</p><h1>{tx(title, language)}</h1>{subtitle && <p>{tx(subtitle, language)}</p>}</div>;
}

function Metric({ icon, label, value, status, tone = "ok" }) {
  const language = useLanguage();
  return <article className="metric-card">{icon}<span className="muted">{tx(label, language)}</span><strong>{value}</strong><Badge tone={tone}>{tx(status, language)}</Badge></article>;
}

function InfoCard({ title, icon, children }) {
  const language = useLanguage();
  return <article className="panel"><h3>{icon} {tx(title, language)}</h3><p>{tx(children, language)}</p></article>;
}

function Badge({ children, tone = "" }) {
  const language = useLanguage();
  return <span className={`badge ${tone}`}>{tx(children, language)}</span>;
}

function Brand({ onClick }) {
  const content = <><span className="brand-mark"><HeartPulse size={20} /></span><span>HealthLink</span></>;
  return onClick ? <button className="brand brand-button" onClick={onClick}>{content}</button> : <div className="brand">{content}</div>;
}

function ThemeButton({ theme, setTheme }) {
  return <button className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun /> : <Moon />}</button>;
}

function LanguageSelect({ language, setLanguage }) {
  const lang = useLanguage();
  return <label className="language-select" title={tx("Choose a language", lang)}><span><Globe2 size={15} /></span><select aria-label={tx("Choose a language", lang)} value={language} onChange={(event) => setLanguage(event.target.value)}>{Object.entries(languageNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>;
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.7 9.5 24 9.5Z" transform="translate(0 5)"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.88c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.36 38.11 47 31.97 47 24.55Z" transform="translate(0 0)"/><path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.2a23.97 23.97 0 0 0 0 21.57l7.98-6.19Z" transform="translate(0 5)"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.17 2.3-6.3 0-11.57-4.22-13.46-9.9l-7.98 6.2C6.51 42.62 14.62 48 24 48Z" transform="translate(0 0)"/><path fill="none" d="M0 0h48v48H0z"/></svg>;
}

function splitLines(value) {
  return String(value || "None").split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

function labelize(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

export default App;
