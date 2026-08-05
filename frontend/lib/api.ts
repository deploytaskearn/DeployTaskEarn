import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 20000,
});

// Attach JWT token from localStorage to every request, if present
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("taskearn_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// On 401 (token actually rejected), clear the stale token so the UI can
// redirect to login. 403 means "authenticated but not allowed to do this
// specific thing" (banned, on hold, admin-only route, ...) — it must NOT
// clear the token, or a single blocked action (e.g. withdrawing while on
// hold) would silently log the user out of an otherwise-valid session.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("taskearn_token");
    }
    return Promise.reject(error);
  }
);

export function uploadUrl(path: string | null) {
  if (!path) return null;
  return `${API_BASE_URL}${path}`;
}

export default api;
