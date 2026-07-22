import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Separate axios instance for admin panel — uses a DIFFERENT token key
// so admin sessions never overwrite user sessions in the same browser.
export const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

adminApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("taskearn_admin_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("taskearn_admin_token");
      window.location.href = "/mg-5bcdfea71b/login";
    }
    return Promise.reject(error);
  }
);

export function uploadUrl(path: string | null) {
  if (!path) return null;
  return `${API_BASE_URL}${path}`;
}

export default adminApi;
