import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../lib/http";
import { getAuth } from "../lib/auth";
import { Search, Heart } from "lucide-react";

type UserItem = {
  id: number;
  username: string;
  role?: string | null;
  Role?: string | null;
  fullName?: string | null;
  FullName?: string | null;
  AvatarUrl?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  HeartCount?: number | null;
  heartCount?: number | null;
};

const AVATAR_FALLBACK =
  "https://cdn.jsdelivr.net/gh/HaiquangPham14/Droppi_ToDoListApp@main/image-Photoroom.png";

// Helpers
function pickName(u: UserItem) {
  return (u.fullName ?? u.FullName ?? u.username ?? "").toString();
}
function pickAvatar(u: UserItem) {
  const s = (u.AvatarUrl ?? u.avatarUrl ?? u.avatar_url ?? "").trim();
  if (!s) return AVATAR_FALLBACK;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
  return s.startsWith("/") ? s : `/${s}`;
}
function pickRole(u: UserItem) {
  return (u.role ?? u.Role ?? "").toString().toLowerCase();
}
function pickMyHearts(me: any): number | null {
  const v = me?.heartCount ?? me?.HeartCount;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function UsersSearch() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());

  // Chặn truy cập nếu chưa đăng nhập
  useEffect(() => {
    if (!auth) nav("/login", { replace: true });
  }, [auth, nav]);

  const [meHearts, setMeHearts] = useState<number | null>(null);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // search (chỉ lọc khi bấm Enter/nút)
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string>("");

  const didInit = useRef(false);

  // Tải dữ liệu 1 lần: thông tin mình + danh sách user
  useEffect(() => {
    if (!auth || didInit.current) return;
    didInit.current = true;

    (async () => {
      try {
        setLoading(true);
        const [meRes, usersRes] = await Promise.all([
          http.get(`/Users/${auth.userId}`),
          http.get(`/Users?pageIndex=1&pageSize=1000`), // BE đã lọc/hoặc FE lọc admin
        ]);

        setMeHearts(pickMyHearts(meRes.data));

        const raw: UserItem[] = Array.isArray(usersRes.data)
          ? usersRes.data
          : usersRes.data?.items ?? [];
        setAllUsers(raw);
      } catch (e: any) {
        setErr("Không tải được danh sách người dùng. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    })();
  }, [auth]);

  // Lọc client: ẩn admin + ẩn chính mình + theo từ khóa đã submit
  const filtered = useMemo(() => {
    const base = allUsers.filter(
      (u) => pickRole(u) !== "admin" && u.id !== auth?.userId
    );
    const q = submitted.trim().toLowerCase();
    if (!q) return base;
    return base.filter((u) => {
      const name = pickName(u).toLowerCase();
      const uname = (u.username ?? "").toString().toLowerCase();
      return name.includes(q) || uname.includes(q);
    });
  }, [allUsers, submitted, auth]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(query);
  }

  function chooseUser(u: UserItem) {
    nav(`/hearts/give/${u.id}`); // sang trang gửi tim cho người được chọn
  }

  if (!auth) return null;

  return (
    <div className="give-wrap">
      <div className="container">
        <div className="page-slab">
          {/* Thanh search + số tim còn lại */}
          <form
            className="search-wrap card"
            onSubmit={onSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              margin: "10px auto 14px",
              width: "100%",
            }}
          >
            <div
              title="Số tim còn lại"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.20)",
                background:
                  "linear-gradient(180deg, var(--brand-600), var(--accent-600))",
                boxShadow: "0 8px 18px rgba(216,180,254,.28)",
                whiteSpace: "nowrap",
                minWidth: 64,
                justifyContent: "center",
              }}
            >
              <Heart size={14} />
              <strong>{meHearts ?? "—"}</strong>
            </div>

            <input
              className="input search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên người dùng rồi bấm Enter hoặc nút tìm…"
              aria-label="Tìm theo tên"
            />
            <button
              type="submit"
              title="Tìm"
              className="btn btn-primary"
              style={{ height: 36, minWidth: 44, padding: "0 12px" }}
            >
              <Search size={18} />
            </button>
          </form>

          {err && <div className="error">{err}</div>}

          {/* Lưới người dùng (4 cột desktop, 2 cột mobile) */}
          <div className="user-grid" style={{ minHeight: 260 }}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="user-card" aria-hidden="true">
                  <div
                    className="user-avatar"
                    style={{ background: "rgba(255,255,255,.10)" }}
                  />
                  <div
                    className="user-name"
                    style={{
                      height: 16,
                      width: "60%",
                      background: "rgba(255,255,255,.12)",
                      borderRadius: 8,
                    }}
                  />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="no-results" style={{ gridColumn: "1 / -1" }}>
                {submitted
                  ? "Không tìm thấy người dùng phù hợp."
                  : "Chưa có dữ liệu người dùng."}
              </div>
            ) : (
              filtered.slice(0, 40).map((u) => {
                const name = pickName(u);
                const av = pickAvatar(u);
                return (
                  <button
                    key={u.id}
                    className="user-card"
                    onClick={() => chooseUser(u)}
                    title={`Chọn ${name}`}
                    type="button"
                  >
                    <div className="user-avatar">
                      <img
                        src={av}
                        alt={name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            AVATAR_FALLBACK;
                        }}
                      />
                    </div>
                    <div className="user-name">{name}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
