import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Search, Heart } from "lucide-react";
import { API_BASE_URL, getAuth, clearAuth } from "../lib/auth";

type UserItem = {
  id: number;
  username: string;
  fullName?: string | null;
  FullName?: string | null;
  role?: string | null;
  Role?: string | null;
  AvatarUrl?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  AvartarUrl?: string | null;
};

const AVATAR_FALLBACK =
  "https://cdn.jsdelivr.net/gh/HaiquangPham14/Droppi_ToDoListApp@main/image-Photoroom.png";

function apiOrigin(): string {
  try {
    const u = new URL(API_BASE_URL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return API_BASE_URL.replace(/\/api\/?$/, "");
  }
}
function toAbs(url?: string | null) {
  const s = (url ?? "").trim();
  if (!s) return null;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
  const base = apiOrigin();
  return `${base}${s.startsWith("/") ? s : `/${s}`}`;
}
function pickAvatar(u: UserItem) {
  return toAbs(u.AvatarUrl ?? u.avatarUrl ?? u.avatar_url ?? u.AvartarUrl) ?? AVATAR_FALLBACK;
}
function pickName(u: UserItem) {
  return (u.fullName ?? u.FullName ?? u.username ?? "").toString();
}
function pickHeartCount(data: any): number | null {
  const v = data?.heartCount ?? data?.HeartCount ?? data?.heart_count;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function HeartsNew() {
  const nav = useNavigate();

  // LẤY AUTH 1 LẦN để tránh đổi tham chiếu gây loop
  const [auth] = useState(() => getAuth());

  // Flag ngăn init chạy lặp (StrictMode)
  const didInit = useRef(false);

  // State trang
  const [authorized, setAuthorized] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Data
  const [myHearts, setMyHearts] = useState<number | null>(null);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [viewUsers, setViewUsers] = useState<UserItem[]>([]);

  // Search (chỉ submit mới lọc)
  const [query, setQuery] = useState("");

  // ===== AUTH GUARD + 2 API (getUserById, getAll) =====
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (!auth) {
      nav("/login", { replace: true });
      return;
    }

    const headers = { Authorization: `Bearer ${auth.token}` };

    (async () => {
      try {
        const [meRes, usersRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/Users/${auth.userId}`, { headers }),
          axios.get(`${API_BASE_URL}/Users`, { headers }),
        ]);

        setMyHearts(pickHeartCount(meRes.data));

        const list: UserItem[] = Array.isArray(usersRes.data)
          ? usersRes.data
          : usersRes.data?.items ?? [];

        setAllUsers(list);
        setViewUsers(list); // mặc định hiển thị tất cả
        setAuthorized(true);
      } catch (e: any) {
        if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) {
          clearAuth();
          nav("/login", { replace: true });
          return;
        }
        setErr("Không tải được dữ liệu. Vui lòng thử lại.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== SEARCH: chỉ khi Enter hoặc click icon =====
  function handleSearchSubmit(e?: React.FormEvent | React.MouseEvent) {
    if (e) e.preventDefault();
    const q = query.trim().toLowerCase();

    if (!q) {
      setViewUsers(allUsers);
      return;
    }

    const filtered = allUsers.filter((u) => {
      const name = pickName(u).toLowerCase();
      const user = (u.username ?? "").toString().toLowerCase();
      return name.includes(q) || user.includes(q);
    });

    setViewUsers(filtered);
  }

  // ===== CLICK USER: điều hướng sang trang chọn số tim =====
  function handleSelectUser(u: UserItem) {
    // ví dụ route: /hearts/give/:id
    nav(`/hearts/give/${u.id}`);
  }

  if (!authorized) return null; // không render gì trước khi init xong (tránh “giật”)

  return (
    <div className="give-wrap">
      <div className="container">
        {/* Thanh search: trái = HeartCount, giữa = input, phải = nút tìm */}
        <form
          className="search-wrap card"
          onSubmit={handleSearchSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            margin: "6px auto 14px",
            maxWidth: 920,
          }}
        >
          {/* HeartCount bên trái */}
          <div
            title="Số tim còn lại"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.20)",
              background: "linear-gradient(180deg, var(--brand-600), var(--accent-600))",
              boxShadow: "0 8px 18px rgba(216,180,254,.28)",
              whiteSpace: "nowrap",
              minWidth: 64,
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Heart size={14} />
            <strong>{myHearts ?? "—"}</strong>
          </div>

          <input
            className="input search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập tên rồi bấm Enter hoặc nút tìm kiếm…"
            aria-label="Tìm theo tên"
          />

          <button
            type="submit"
            title="Tìm"
            style={{
              display: "inline-grid",
              placeItems: "center",
              color: "var(--w-90)",
              background: "linear-gradient(180deg, var(--brand-600), var(--accent-600))",
              border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 10,
              padding: "0 12px",
              height: 36,
              cursor: "pointer",
              minWidth: 44,
            }}
          >
            <Search size={18} />
          </button>
        </form>

        {err && <div className="error" style={{ marginTop: 12 }}>{err}</div>}

        {/* Grid người dùng — chỉ để chọn (KHÔNG thả tim tại trang này) */}
        <div className="user-grid">
          {viewUsers.length === 0 ? (
            <div className="no-results" style={{ gridColumn: "1 / -1" }}>
              Không tìm thấy người dùng phù hợp.
            </div>
          ) : (
            viewUsers.map((u) => {
              const name = pickName(u);
              const avatar = pickAvatar(u);
              return (
                <button
                  key={u.id}
                  className="user-card"
                  onClick={() => handleSelectUser(u)}
                  title={`Chọn ${name}`}
                >
                  <div className="user-avatar">
                    <img
                      src={avatar}
                      alt={name}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK; }}
                    />
                  </div>
                  <div className="user-name" title={name}>{name}</div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
