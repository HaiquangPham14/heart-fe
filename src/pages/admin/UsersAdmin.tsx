import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftCircle, Search, Plus, Edit2, Trash2, Users, Save, X, Loader2,
} from "lucide-react";
import http from "../../lib/http";
import { getAuth } from "../../lib/auth";

type UserItem = {
  id: number;
  username: string;
  fullName?: string | null;
  role?: string | null;
  teamId?: number | null;
  teamName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
};

type TeamItem = { id: number; name: string };

// Hook rất nhẹ để biết màn hình nhỏ -> chỉ hiện icon cho nút
function useIsSmall(bp = 480) {
  const [small, setSmall] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= bp : true));
  useEffect(() => {
    const onResize = () => setSmall(window.innerWidth <= bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);
  return small;
}

export default function UsersAdmin() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());
  const isAdmin = useMemo(() => (auth?.role || "").toLowerCase() === "admin", [auth?.role]);
  const mounted = useRef(true);
  const isSmall = useIsSmall(480);

  // master list (client-side paging)
  const [allItems, setAllItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // paging + search
  const [pageIndex, setPageIndex] = useState(1); // 1-based
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");

  // teams
  const [teams, setTeams] = useState<TeamItem[]>([]);

  // drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);

  // form fields
  const [fUsername, setFUsername] = useState("");
  const [fFullName, setFFullName] = useState("");
  const [fPassword, setFPassword] = useState("");
  const [fRole, setFRole] = useState<string>("user");
  const [fTeamId, setFTeamId] = useState<number | "">("");
  const [fEmail, setFEmail] = useState("");
  const [fAvatarUrl, setFAvatarUrl] = useState("");

  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(
    () => fUsername.trim().length >= 3 && (editing ? true : fPassword.trim().length >= 6),
    [fUsername, fPassword, editing]
  );

  const AVATAR_FALLBACK =
    "https://cdn.jsdelivr.net/gh/HaiquangPham14/Droppi_ToDoListApp@main/image-Photoroom.png";

  const totalCount = allItems.length;
  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (pageIndex - 1) * pageSize;
  const pageItems = useMemo(() => allItems.slice(offset, offset + pageSize), [allItems, offset, pageSize]);

  const handleBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/admin", { replace: true });
  };

  async function loadTeams() {
    try {
      const res = await http.get("/Teams", { params: { pageIndex: 1, pageSize: 1000 } });
      const list: TeamItem[] = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setTeams(list);
    } catch {/* ignore */ }
  }

  async function loadUsersAll(q: string) {
    setLoading(true);
    setErr(null);
    try {
      const base = q?.trim() ? "/users/search" : "/users";
      const params = q?.trim()
        ? { pageIndex: 1, pageSize: 100000, query: q.trim() }
        : { pageIndex: 1, pageSize: 100000 };
      const res = await http.get(base, { params });
      const items: UserItem[] = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      setAllItems(items);
      setPageIndex(1);
    } catch {
      try {
        const res2 = await http.get("/Users", { params: { pageIndex: 1, pageSize: 100000, query: q?.trim() || undefined } });
        const items2: UserItem[] = Array.isArray(res2.data) ? res2.data : (res2.data?.items ?? []);
        setAllItems(items2);
        setPageIndex(1);
      } catch {
        setErr("Không tải được danh sách người dùng.");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  function goPage(dir: "prev" | "next") {
    const next = dir === "prev" ? Math.max(1, pageIndex - 1) : Math.min(maxPage, pageIndex + 1);
    if (next !== pageIndex) {
      setPageIndex(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function openAdd() {
    setEditing(null);
    setFUsername("");
    setFFullName("");
    setFPassword("");
    setFRole("user");
    setFTeamId("");
    setFEmail("");
    setFAvatarUrl("");
    setDrawerOpen(true);
  }
  function openEdit(u: UserItem) {
    setEditing(u);
    setFUsername(u.username || "");
    setFFullName(u.fullName || "");
    setFPassword("");
    setFRole((u.role ?? "user") as string);
    setFTeamId(u.teamId ?? "");
    setFEmail(u.email || "");
    setFAvatarUrl(u.avatarUrl || "");
    setDrawerOpen(true);
  }
  function closeDrawer() { setDrawerOpen(false); }

  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;

    const username = (editing?.username ?? fUsername).trim();
    const payload: any = {
      username,
      fullName: (fFullName.trim() || editing?.fullName || editing?.username || " ").toString(),
      role: (editing?.role || fRole || "user").toString(),
      teamId: fTeamId === "" ? null : Number(fTeamId),
      password: editing ? (fPassword.trim() || "") : fPassword.trim(),
      email: fEmail.trim() || null,
      avatarUrl: fAvatarUrl.trim() || null,
    };

    setSaving(true);
    setErr(null);
    try {
      if (!editing) {
        await http.post("/users", payload);            // nếu có /Admin/users thì đổi tại đây
      } else {
        await http.put(`/users/${editing.id}`, payload, { params: { ActionById: auth?.userId } });
      }
      closeDrawer();
      await loadUsersAll(query);
    } catch {
      setErr("Lưu thất bại. Vui lòng kiểm tra dữ liệu.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(u: UserItem) {
    const ok = window.confirm(`Xóa người dùng "${u.fullName || u.username}"?`);
    if (!ok) return;
    try {
      await http.delete(`/users/${u.id}`);             // nếu có /Admin/users thì đổi tại đây
      const remain = totalCount - 1;
      const newMaxPage = Math.max(1, Math.ceil(remain / pageSize));
      const newPi = pageIndex > newMaxPage ? newMaxPage : pageIndex;
      await loadUsersAll(query);
      setPageIndex(newPi);
    } catch {
      alert("Xóa thất bại.");
    }
  }

  useEffect(() => {
    if (!auth) { nav("/login", { replace: true }); return; }
    mounted.current = true;
    loadTeams();
    loadUsersAll("");
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmitSearch(e: React.FormEvent) { e.preventDefault(); loadUsersAll(query); }
  function clearSearch() { setQuery(""); loadUsersAll(""); }

  return (
    <div className="give-wrap">
      <div className="container">
        <div className="page-slab" style={{ display: "grid", gap: 12 }}>

          {/* Back */}
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <button
              onClick={handleBack}
              aria-label="Quay lại"
              title="Quay lại"
              style={{
                width: 72, height: 72, background: "transparent", border: "none",
                display: "grid", placeItems: "center", cursor: "pointer", color: "#fff",
                filter: "drop-shadow(0 6px 12px rgba(0,0,0,.35))",
              }}
            >
              <ArrowLeftCircle size={56} strokeWidth={2.5} />
            </button>
          </div>

          {/* Header & Stats */}
          <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={18} />
                <div style={{ fontWeight: 800, fontSize: 18 }}>Quản lý người dùng</div>
              </div>
              <div className="muted">Tổng: <b>{totalCount.toLocaleString()}</b></div>
            </div>

            {/* Controls – mobile-first: 2 hàng */}
            <div style={{ display: "grid", gap: 10 }}>
              {/* Hàng 1: Search */}
              <form onSubmit={onSubmitSearch} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    placeholder="Tìm theo tên hoặc username…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Xoá từ khoá"
                      className="btn btn-ghost"
                      onClick={clearSearch}
                      style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Search size={16} /> Tìm
                </button>
              </form>

              {/* Hàng 2: Page size + Thêm */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select
                  className="input"
                  value={pageSize}
                  onChange={(e) => { const ps = Number(e.target.value) || 10; setPageSize(ps); setPageIndex(1); }}
                  title="Số dòng / trang"
                  style={{ background: "rgba(255,255,255,.06)", color: "var(--w-90, #fff)", border: "1px solid rgba(255,255,255,.22)" }}
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={n} style={{ color: "#000" }}>{n}/trang</option>
                  ))}
                </select>

                <button className="btn" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Plus size={16} /> Thêm
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="card" style={{ padding: 12 }}>
            {loading ? (
              <div className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Loader2 size={16} className="spin" /> Đang tải…
              </div>
            ) : err ? (
              <div className="error">{err}</div>
            ) : pageItems.length === 0 ? (
              <div className="muted">Không có người dùng.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {pageItems.map((u) => (
                  <li key={u.id} className="card" style={{ padding: 12 }}>
                    {/* Hàng trên: avatar | tên (ellipsis) | actions (nowrap) */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "48px 1fr auto",
                        alignItems: "center",
                        columnGap: 10,
                      }}
                    >
                      {/* Avatar */}
                      <img
                        src={u.avatarUrl || AVATAR_FALLBACK}
                        alt={u.username}
                        width={48}
                        height={48}
                        style={{
                          width: 48, height: 48, borderRadius: 9999, objectFit: "cover",
                          border: "1px solid rgba(0,0,0,.08)", background: "#fff", flex: "0 0 auto",
                        }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK; }}
                      />

                      {/* Tên + username (ellipsis) */}
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={u.fullName || u.username}
                        >
                          {u.fullName || u.username}
                        </div>
                        <div
                          className="muted"
                          style={{
                            fontSize: 12,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={`@${u.username} · ${u.role || "user"}`}
                        >
                          @{u.username} · {u.role || "user"}
                        </div>
                      </div>

                      {/* Actions – luôn giữ trên 1 dòng, thu gọn label ở mobile */}
                      <div style={{ display: "inline-flex", gap: 6, whiteSpace: "nowrap" }}>
                        <button className="btn btn-ghost" onClick={() => openEdit(u)} title="Sửa" aria-label="Sửa">
                          <Edit2 size={16} /> {!isSmall && <span>Sửa</span>}
                        </button>
                        {isAdmin && (
                          <button className="btn btn-ghost" onClick={() => deleteUser(u)} title="Xóa" aria-label="Xóa">
                            <Trash2 size={16} /> {!isSmall && <span>Xóa</span>}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Hàng dưới: team + email (cũng ellipsis) */}
                    <div className="muted" style={{ fontSize: 12, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Team: <b>{u.teamName || (teams.find((t) => t.id === u.teamId)?.name ?? (u.teamId ?? "—"))}</b>
                      {u.email ? <span> · {u.email}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pagination */}
          <div className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => goPage("prev")} disabled={pageIndex <= 1}>Trước</button>
            <div className="muted">Trang <b>{pageIndex}</b> / <b>{maxPage}</b></div>
            <button className="btn" onClick={() => goPage("next")} disabled={pageIndex >= maxPage}>Sau</button>
          </div>
        </div>
      </div>

      {/* Drawer / Modal */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            display: "grid",
            placeItems: "center",
            padding: 12,
            zIndex: 30,
            backdropFilter: "blur(2px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeDrawer(); }}
        >
          <div
            className="card"
            style={{
              width: "100%", maxWidth: 560, padding: 14,
              background: "rgba(20,22,28,.96)", border: "1px solid rgba(255,255,255,.15)",
              boxShadow: "0 12px 32px rgba(0,0,0,.5)", borderRadius: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {editing ? "Sửa người dùng" : "Thêm người dùng"}
              </div>
              <button className="btn btn-ghost" onClick={closeDrawer} aria-label="Đóng">
                <X size={16} /> Đóng
              </button>
            </div>

            <form onSubmit={submitForm} style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 10, alignItems: "center" }}>
                <img
                  src={fAvatarUrl || AVATAR_FALLBACK}
                  alt="avatar"
                  width={56}
                  height={56}
                  style={{ width: 56, height: 56, borderRadius: 9999, objectFit: "cover", border: "1px solid rgba(255,255,255,.2)", background: "#fff" }}
                  onError={(e) => ((e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK)}
                />
                <div>
                  <label className="label">Avatar URL</label>
                  <input
                    className="input"
                    value={fAvatarUrl}
                    onChange={(e) => setFAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.22)", color: "var(--w-90, #fff)" }}
                  />
                </div>
              </div>

              <div>
                <label className="label">Tài khoản (username)</label>
                <input
                  className="input"
                  value={fUsername}
                  onChange={(e) => setFUsername(e.target.value)}
                  required minLength={3}
                  disabled={!!editing}
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.22)", color: "var(--w-90, #fff)" }}
                />
              </div>

              <div>
                <label className="label">Họ tên</label>
                <input
                  className="input"
                  value={fFullName}
                  onChange={(e) => setFFullName(e.target.value)}
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.22)", color: "var(--w-90, #fff)" }}
                />
              </div>

              <div>
                <label className="label">{editing ? "Đổi mật khẩu (tuỳ chọn)" : "Mật khẩu"}</label>
                <input
                  className="input"
                  type="password"
                  value={fPassword}
                  onChange={(e) => setFPassword(e.target.value)}
                  placeholder={editing ? "Để trống nếu không đổi" : "••••••••"}
                  minLength={editing ? 0 : 6}
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.22)", color: "var(--w-90, #fff)" }}
                />
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  className="input" type="email" value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)} placeholder="name@example.com"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.22)", color: "var(--w-90, #fff)" }}
                />
              </div>

              <div>
                <label className="label">Team</label>
                <select
                  className="input" value={fTeamId}
                  onChange={(e) => setFTeamId(e.target.value ? Number(e.target.value) : "")}
                  disabled={!isAdmin}
                  style={{
                    background: "rgba(255,255,255,.06)", color: "var(--w-90, #fff)",
                    border: "1px solid rgba(255,255,255,.22)", WebkitAppearance: "none", appearance: "none", paddingRight: 28,
                  }}
                >
                  <option value="" style={{ color: "#000" }}>(Không thuộc team)</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} style={{ color: "#000" }}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Vai trò</label>
                <select
                  className="input" value={fRole} onChange={(e) => setFRole(e.target.value)}
                  disabled={!isAdmin}
                  style={{
                    background: "rgba(255,255,255,.06)", color: "var(--w-90, #fff)",
                    border: "1px solid rgba(255,255,255,.22)", WebkitAppearance: "none", appearance: "none", paddingRight: 28,
                  }}
                >
                  <option value="user" style={{ color: "#000" }}>user</option>
                  <option value="admin" style={{ color: "#000" }}>admin</option>
                </select>
              </div>

              {err && <div className="error">{err}</div>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button type="button" className="btn" onClick={closeDrawer}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                  {editing ? "Lưu" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
