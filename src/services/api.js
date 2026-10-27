const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  const contentType = response.headers.get("content-type") || "";
  const result = response.status === 204
    ? null
    : contentType.includes("application/json")
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    throw new Error(result?.message || `Request failed (${response.status})`);
  }

  return result;
}

export const healthLinkApi = {
  signIn: (credentials) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    }),

  register: (details) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(details)
    }),

  getMe: () => apiRequest("/auth/me"),
  signOut: () => apiRequest("/auth/logout", { method: "POST" }),
  getPortal: () => apiRequest("/portal"),

  savePortal: (data) =>
    apiRequest("/portal", {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  uploadMedicalHistoryDocument: (details) =>
    apiRequest("/medical-history/documents", {
      method: "POST",
      body: JSON.stringify(details)
    }),
  medicalHistoryDocumentUrl: (id) => `${API_BASE_URL}/medical-history/documents/${encodeURIComponent(id)}`,

  verifyPatientAccess: (details) =>
    apiRequest("/access/verify", {
      method: "POST",
      body: JSON.stringify(details)
    })
};