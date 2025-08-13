import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../lib/http";
import { API_BASE_URL, getAuth } from "../lib/auth";
import { Heart, Mail, ArrowLeftCircle } from "lucide-react";

type TotalRes = {
  userId: number;
  fromHearts: number;
  fromAdjustments: number;
  total: number;
};

type UserDto = {
  id: number;
  username: string;
  fullName?: string | null;
  FullName?: string | null;
  AvatarUrl?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
};

type MessageDto = {
  id: number;
  content: string;
  isRead?: boolean;
  createdAt?: string;
  sender?: { id: number; username?: string; fullName?: string | null };
  receiver?: { id: number; username?: string; fullName?: string | null };
};

const AVATAR_FALLBACK =
  "https://cdn.jsdelivr.net/gh/HaiquangPham14/Droppi_ToDoListApp@main/image-Photoroom.png";

// helpers
function apiOrigin(): string {
  try { const u = new URL(API_BASE_URL); return `${u.protocol}//${u.host}`; }
  catch { return API_BASE_URL.replace(/\/api\/?$/, ""); }
}
function toAbs(url?: string | null) {
  const s = (url ?? "").trim();
  if (!s) return AVATAR_FALLBACK;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
  const base = apiOrigin();
  return `${base}${s.startsWith("/") ? s : `/${s}`}`;
}
function pickName(u?: UserDto | null) {
  if (!u) return "";
  // @ts-ignore
  return (u.fullName ?? u.FullName ?? u.username ?? "").toString();
}
function pickAvatar(u?: UserDto | null) {
  // @ts-ignore
  const raw = (u?.AvatarUrl ?? u?.avatarUrl ?? u?.avatar_url ?? "") as string;
  return toAbs(raw) || AVATAR_FALLBACK;
}
function fmtTime(s?: string) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleString();
}
function normalizeList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as any;
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.data)) return o.data as T[];
  }
  return [];
}

export default function PersonalHearts() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());
  useEffect(() => { if (!auth) nav("/login", { replace: true }); }, [auth, nav]);
  if (!auth) return null;

  const [me, setMe] = useState<UserDto | null>(null);
  const [sum, setSum] = useState<TotalRes | null>(null);
  const [inbox, setInbox] = useState<MessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const handleBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/", { replace: true });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const [meRes, totalRes, inboxRes] = await Promise.all([
          http.get<UserDto>(`/Users/${auth.userId}`),
          http.get<TotalRes>(`/Users/${auth.userId}/hearts/total`),
          http.get(`/Users/${auth.userId}/inbox`, {
            params: { pageIndex: 1, pageSize: 50, onlyOthers: true },
          }),
        ]);
        if (!mounted) return;
        setMe(meRes.data);
        setSum(totalRes.data);
        setInbox(normalizeList<MessageDto>(inboxRes.data));
      } catch {
        if (!mounted) return;
        setErr("Không tải được dữ liệu. Vui lòng thử lại.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [auth]);

  const name = pickName(me) || me?.username || "";
  const avatar = pickAvatar(me);

  return (
    <div className="give-wrap">
      <div className="container">
        <div className="page-slab" style={{ display: "grid", gap: 12 }}>

          {/* Icon Back (trong suốt, chỉ icon màu trắng) nằm phía trên bên trái */}
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <button
              onClick={handleBack}
              aria-label="Quay lại"
              title="Quay lại"
              style={{
                width: 72,
                height: 72,
                background: "transparent",
                border: "none",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#fff", // lucide dùng currentColor
                filter: "drop-shadow(0 6px 12px rgba(0,0,0,.35))", // để nổi trên nền sáng
              }}
            >
              <ArrowLeftCircle size={56} strokeWidth={2.5} />
            </button>
          </div>

          {/* Khung user */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={avatar}
                alt={name}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK; }}
                style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,.18)" }}
              />
              <div style={{ display: "grid" }}>
                <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>{name}</div>
                <div className="muted">@{me?.username}</div>
              </div>
            </div>
          </div>

          {/* Tổng tim — khung to, số bự, giữa */}
          <div
            className="card"
            style={{
              padding: 24,
              minHeight: 160,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <div className="muted" style={{ fontSize: 16, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
                <Heart size={18} /> Tổng tim đã nhận
              </div>
              <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1 }}>
                {loading ? "…" : sum?.total ?? 0}
              </div>
            </div>
          </div>

          {/* Inbox – fullName, content, createdAt */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Mail size={18} />
              <h2 style={{ margin: 0, fontSize: 16 }}>Lời nhắn gửi đến bạn</h2>
            </div>

            {err && <div className="error" style={{ marginTop: 8 }}>{err}</div>}

            {loading ? (
              <div className="muted" style={{ marginTop: 10 }}>Đang tải…</div>
            ) : inbox.length === 0 ? (
              <div className="no-results" style={{ marginTop: 10 }}>Chưa có lời nhắn nào.</div>
            ) : (
              <ul style={{ marginTop: 10, display: "grid", gap: 10, listStyle: "none", padding: 0 }}>
                {inbox.map(m => (
                  <li key={m.id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <strong>{m.sender?.fullName ?? "Ẩn danh"}</strong>
                      <span className="muted" style={{ fontSize: 12 }}>{fmtTime(m.createdAt)}</span>
                    </div>
                    <div style={{ marginTop: 6, lineHeight: 1.5 }}>{m.content}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
