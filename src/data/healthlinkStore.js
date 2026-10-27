const DATA_KEY = "healthlink-react-data-v1";
const SESSION_KEY = "healthlink-react-session";

const image = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=85`;

export const seedData = {
  patients: [
    { id: "P1001", patientId: "PAT-2026-001", password: "patient123", name: "Aarav Patel", email: "patient@demo.com", age: 28, gender: "Male", bloodGroup: "B+", height: 175, weight: 72, phone: "+91 98765 43210", emergencyContact: "+91 90000 11111", address: "Ahmedabad, Gujarat", photo: image("photo-1500648767791-00dcc994a43e"), conditions: ["Mild asthma", "Seasonal allergies"], allergies: ["Dust", "Penicillin"], medications: ["Vitamin D"], surgeries: ["Appendectomy - 2020"], familyHistory: "Father: Hypertension. Mother: None recorded.", accessCode: "ACCESS-48291", doctorAccess: true },
    { id: "P1002", patientId: "PAT-2026-002", password: "patient123", name: "Hetvi Shah", email: "hetvi@demo.com", age: 22, gender: "Female", bloodGroup: "O+", height: 162, weight: 58, phone: "+91 98888 12345", emergencyContact: "+91 94444 22222", address: "Surat, Gujarat", photo: image("photo-1494790108377-be9c29b29330"), conditions: ["Migraine"], allergies: ["Peanuts"], medications: ["Iron supplement"], surgeries: ["None"], familyHistory: "Grandfather: Diabetes.", accessCode: "ACCESS-29410", doctorAccess: true },
    { id: "P1003", patientId: "PAT-2026-003", password: "patient123", name: "Neel Mehta", email: "neel@demo.com", age: 35, gender: "Male", bloodGroup: "A+", height: 172, weight: 80, phone: "+91 96666 12345", emergencyContact: "+91 95555 33333", address: "Vadodara, Gujarat", photo: image("photo-1506794778202-cad84cf45f1d"), conditions: ["Hypertension"], allergies: ["None"], medications: ["BP medicine"], surgeries: ["Knee repair - 2019"], familyHistory: "Father: Hypertension.", accessCode: "ACCESS-64031", doctorAccess: false },
    { id: "P1004", patientId: "PAT-2026-004", password: "patient123", name: "Mira Iyer", email: "mira@demo.com", age: 31, gender: "Female", bloodGroup: "AB+", height: 168, weight: 65, phone: "+91 97777 44444", emergencyContact: "+91 93333 44444", address: "Mumbai, Maharashtra", photo: image("photo-1534528741775-53994a69daeb"), conditions: ["Thyroid"], allergies: ["Dust"], medications: ["Thyroid medicine"], surgeries: ["None"], familyHistory: "Mother: Thyroid.", accessCode: "ACCESS-80014", doctorAccess: true },
    { id: "P1005", patientId: "PAT-2026-005", password: "patient123", name: "Kabir Rao", email: "kabir@demo.com", age: 44, gender: "Male", bloodGroup: "O-", height: 178, weight: 86, phone: "+91 99999 55555", emergencyContact: "+91 92222 55555", address: "Pune, Maharashtra", photo: image("photo-1472099645785-5658abf4ff4e"), conditions: ["Diabetes"], allergies: ["Shellfish"], medications: ["Metformin"], surgeries: ["None"], familyHistory: "Father: Diabetes.", accessCode: "ACCESS-58320", doctorAccess: false }
  ],
  doctors: [
    { id: "D1001", doctorId: "DOC-1001", password: "doctor123", name: "Dr. Ananya Shah", email: "doctor@demo.com", specialization: "General Physician", experience: "9 years", hospital: "HealthLink Care Center", availability: "Mon-Fri, 9 AM - 5 PM", city: "Ahmedabad", country: "India", languages: ["English", "Gujarati", "Hindi"], fee: 600, rating: 4.9, photo: image("photo-1559839734-2b71ea197ec2") },
    { id: "D1002", doctorId: "DOC-1002", password: "doctor123", name: "Dr. Raj Malhotra", specialization: "Cardiologist", experience: "14 years", hospital: "Apollo Health", availability: "Tue-Sat, 10 AM - 4 PM", city: "Mumbai", country: "India", languages: ["English", "Hindi"], fee: 1200, rating: 4.8, photo: image("photo-1622253692010-333f2da6031d") },
    { id: "D1003", doctorId: "DOC-1003", password: "doctor123", name: "Dr. Nisha Kapoor", specialization: "Dermatologist", experience: "7 years", hospital: "SkinPlus Clinic", availability: "Mon-Thu, 11 AM - 6 PM", city: "Surat", country: "India", languages: ["English", "Gujarati", "Hindi"], fee: 800, rating: 4.9, photo: image("photo-1594824476967-48c8b964273f") },
    { id: "D1004", doctorId: "DOC-1004", password: "doctor123", name: "Dr. Sameer Desai", specialization: "Orthopedic", experience: "11 years", hospital: "City Hospital", availability: "Wed-Sun, 9 AM - 2 PM", city: "Vadodara", country: "India", languages: ["English", "Hindi"], fee: 900, rating: 4.7, photo: image("photo-1612349317150-e413f6a5b16d") },
    { id: "D1005", doctorId: "DOC-1005", password: "doctor123", name: "Dr. Priya Menon", specialization: "Endocrinologist", experience: "12 years", hospital: "Metro Medical", availability: "Mon-Fri, 12 PM - 7 PM", city: "Pune", country: "India", languages: ["English", "Hindi", "Marathi"], fee: 1000, rating: 4.9, photo: image("photo-1582750433449-648ed127bb54") }
  ],
  appointments: [
    { id: "A1", patientId: "PAT-2026-001", doctorId: "DOC-1001", doctor: "Dr. Ananya Shah", specialization: "General Physician", date: "2026-09-18", time: "10:30", status: "Confirmed" },
    { id: "A2", patientId: "PAT-2026-001", doctorId: "DOC-1002", doctor: "Dr. Raj Malhotra", specialization: "Cardiologist", date: "2026-09-21", time: "12:00", status: "Pending" },
    { id: "A3", patientId: "PAT-2026-002", doctorId: "DOC-1003", doctor: "Dr. Nisha Kapoor", specialization: "Dermatologist", date: "2026-09-19", time: "15:15", status: "Confirmed" },
    { id: "A4", patientId: "PAT-2026-003", doctorId: "DOC-1002", doctor: "Dr. Raj Malhotra", specialization: "Cardiologist", date: "2026-09-17", time: "11:00", status: "Completed" },
    { id: "A5", patientId: "PAT-2026-004", doctorId: "DOC-1005", doctor: "Dr. Priya Menon", specialization: "Endocrinologist", date: "2026-09-24", time: "16:00", status: "Pending" },
    { id: "A6", patientId: "PAT-2026-005", doctorId: "DOC-1005", doctor: "Dr. Priya Menon", specialization: "Endocrinologist", date: "2026-09-22", time: "09:30", status: "Confirmed" },
    { id: "A7", patientId: "PAT-2026-001", doctorId: "DOC-1004", doctor: "Dr. Sameer Desai", specialization: "Orthopedic", date: "2026-08-12", time: "10:00", status: "Completed" },
    { id: "A8", patientId: "PAT-2026-002", doctorId: "DOC-1001", doctor: "Dr. Ananya Shah", specialization: "General Physician", date: "2026-09-28", time: "13:00", status: "Cancelled" }
  ],
  reports: [
    { id: "R1", patientId: "PAT-2026-001", name: "Complete Blood Count.pdf", type: "Blood Test", date: "2026-09-02", uploadedBy: "Patient" },
    { id: "R2", patientId: "PAT-2026-001", name: "Chest X-Ray.png", type: "X-Ray", date: "2026-08-12", uploadedBy: "Dr. Ananya Shah" },
    { id: "R3", patientId: "PAT-2026-002", name: "Allergy Panel.pdf", type: "Health Report", date: "2026-05-03", uploadedBy: "Patient" },
    { id: "R4", patientId: "PAT-2026-003", name: "BP Followup.pdf", type: "Health Report", date: "2026-09-01", uploadedBy: "Doctor" }
  ],
  prescriptions: [
    { id: "RX1", patientId: "PAT-2026-001", doctor: "Dr. Ananya Shah", diagnosis: "Seasonal cough notes", medicine: "Paracetamol", dosage: "500 mg", frequency: "As prescribed", duration: "3 days", instructions: "Take after food", date: "2026-09-10" },
    { id: "RX2", patientId: "PAT-2026-003", doctor: "Dr. Raj Malhotra", diagnosis: "BP monitoring", medicine: "Amlodipine", dosage: "5 mg", frequency: "Morning", duration: "30 days", instructions: "Monitor BP regularly", date: "2026-09-01" }
  ],
  reminders: [
    { id: "M1", patientId: "PAT-2026-001", medicine: "Vitamin D", time: "08:00", dosage: "1 tablet", frequency: "Daily", taken: false },
    { id: "M2", patientId: "PAT-2026-001", medicine: "Inhaler check", time: "20:00", dosage: "As directed", frequency: "Daily", taken: false },
    { id: "M3", patientId: "PAT-2026-002", medicine: "Iron supplement", time: "13:00", dosage: "1 tablet", frequency: "Daily", taken: false },
    { id: "M4", patientId: "PAT-2026-005", medicine: "Metformin", time: "20:00", dosage: "500 mg", frequency: "Daily", taken: false }
  ],
  visits: [
    { patientId: "PAT-2026-001", date: "2026-08-12", hospital: "City Hospital", reason: "Knee pain", doctor: "Dr. Sameer Desai", treatment: "Rest and physiotherapy" },
    { patientId: "PAT-2026-001", date: "2026-07-12", hospital: "HealthLink Care Center", reason: "Breathing discomfort", doctor: "Dr. Ananya Shah", treatment: "Observation and inhaler review" }
  ],
  notes: [],
  accessHistory: [{ patientId: "PAT-2026-001", doctor: "Dr. Ananya Shah", date: "2026-09-16", time: "10:15", type: "Temporary code access" }],
  notifications: [
    { id: "N1", userId: "PAT-2026-001", text: "Medication reminder scheduled for 8:00 PM.", read: false },
    { id: "N2", userId: "PAT-2026-001", text: "Upcoming appointment with Dr. Ananya Shah.", read: false },
    { id: "N3", userId: "PAT-2026-001", text: "Blood test report uploaded.", read: true },
    { id: "N4", userId: "DOC-1001", text: "Two appointment requests need review.", read: false }
  ],
  settings: { emergencyNumber: "Configure in settings", language: "English" }
};

export function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) return JSON.parse(raw);
    const initialData = structuredClone(seedData);
    localStorage.setItem(DATA_KEY, JSON.stringify(initialData));
    return initialData;
  } catch (error) {
    // A malformed or unavailable browser store should not prevent the demo from opening.
    console.warn("HealthLink demo storage could not be loaded; starting with sample data.", error);
    return structuredClone(seedData);
  }
}

export function saveData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function loadSession() {
  return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function calculateBmi(patient) {
  const meters = Number(patient?.height) / 100;
  const value = Number(patient?.weight) / (meters * meters);
  const rounded = Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
  let category = "Normal";
  if (rounded < 18.5) category = "Underweight";
  if (rounded >= 25) category = "Overweight";
  if (rounded >= 30) category = "Obesity";
  return { value: rounded, category };
}

export function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
