import axios from "axios";
import { API_BASE_URL, getAuth, clearAuth } from "./auth";

const http = axios.create({
  baseURL: API_BASE_URL,   // ví dụ: https://localhost:44374/api
  timeout: 15000,
});

// Gắn Bearer token cho mọi request
http.interceptors.request.use((config) => {
  const a = getAuth();
  if (a?.token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${a.token}`;
  }
  return config;
});

let redirecting = false;
http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const method = error?.config?.method?.toUpperCase();
    const url = (error?.config?.url || "").toLowerCase();

    // Chỉ redirect khi:
    // - Là 401/403 thực sự (không phải OPTIONS preflight)
    // - Không phải call /auth/login|/auth/register
    if (
      (status === 401 || status === 403) &&
      method !== "OPTIONS" &&
      !url.includes("/auth/login") &&
      !url.includes("/auth/register") &&
      !redirecting
    ) {
      redirecting = true;
      try { clearAuth(); } catch {}
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?next=${next}`);
      return; // ngắt luôn
    }
    return Promise.reject(error);
  }
);

export default http;
