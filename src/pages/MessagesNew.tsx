import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Search, ArrowLeftCircle } from "lucide-react";
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

export default function MessagesNew() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());
  const didInit = useRef(false);

  const [authorized, setAuthorized] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [viewUsers, setViewUsers] = useState<UserItem[]>([]);
  const [query, setQuery] = useState("");

  // ==== AUTH GUARD + tải danh sách Users ====
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
        setErr(null);
        const usersRes = await axios.get(`${API_BASE_URL}/Users`, { headers });
        const list: UserItem[] = Array.isArray(usersRes.data)
          ? usersRes.data
          : usersRes.data?.items ?? [];
        setAllUsers(list);
        setViewUsers(list);
        setAuthorized(true);
      } catch (e: any) {
        if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) {
          clearAuth();
          nav("/login", { replace: true });
          return;
        }
        setErr("Không tải được danh sách người dùng. Vui lòng thử lại.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==== SEARCH: chỉ lọc khi submit ====
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

  // ==== CLICK USER: điều hướng tới trang soạn tin ====
  function handleSelectUser(u: UserItem) {
    nav(`/messages/new/${u.id}`);
  }

  function handleBack() {
    if (window.history.length > 1) nav(-1);
    else nav("/", { replace: true });
  }

  if (!authorized) return null;

  return (
    <div className="give-wrap">
      <div className="container">
        {/* Nút Back giống TeamHearts: icon trắng, trong suốt, ở trên bên trái */}
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
              color: "#fff",
              filter: "drop-shadow(0 6px 12px rgba(0,0,0,.35))",
            }}
          >
            <ArrowLeftCircle size={56} strokeWidth={2.5} />
          </button>
        </div>

        {/* Thanh search: chỉ input + nút tìm (không hiện tim) */}
        <form
          className="search-wrap card"
          onSubmit={handleSearchSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            margin: "6px auto 14px",
            maxWidth: 920,
          }}
        >
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

        {/* Danh sách người dùng để chọn */}
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
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK;
                      }}
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
