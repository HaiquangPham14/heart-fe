import axios from "axios";

export const API_BASE_URL =
  (import.meta as any).env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:44374/api";

export interface AuthUser {
  token: string;
  userId: number;
  username: string;
  role: string;
  avatarUrl?: string | null; // <-- FE dùng tên chuẩn này
}

function pickAvatarUrl(data: any): string | null {
  // Hỗ trợ mọi biến thể tên thuộc tính từ BE
  const raw =
    data?.AvatarUrl ?? // <- BE của bạn đang trả tên này
    data?.AvatarUrl ??
    data?.avatarUrl ??
    data?.avatar_url ??
    null;

  const url = (raw ?? "").toString().trim();
  return url.length > 0 ? url : null;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const { data } = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
  const authUser: AuthUser = {
    token: data.token,
    userId: data.userId,
    username: data.username,
    role: data.role,
    avatarUrl: pickAvatarUrl(data), // lấy avatar thực từ LoginResponse
  };
  localStorage.setItem("auth", JSON.stringify(authUser));
  return authUser;
}

export function getAuth(): AuthUser | null {
  const raw = localStorage.getItem("auth");
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

export function clearAuth() {
  localStorage.removeItem("auth");
}
