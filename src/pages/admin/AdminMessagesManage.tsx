// src/pages/admin/AdminMessagesManage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftCircle, Search, Plus, Trash2, Send, X, Loader2, Mail, User,
} from "lucide-react";
import http from "../../lib/http";
import { getAuth } from "../../lib/auth";

/* ============== Types ============== */
type UserBrief = {
  id: number;
  username: string;
  fullName?: string | null;
  avatar?: string | null; // <- BE trả field avatar
};

type MessageItem = {
  id: number;
  content: string;
  createdAt?: string | null;
  isRead?: boolean | null;
  sender: UserBrief;
  receiver: UserBrief;
};

/* ============== Utils ============== */
function formatTime(x?: string | null) {
  if (!x) return "";
  try { return new Date(x).toLocaleString(); } catch { return x; }
}

function displayName(u?: { fullName?: string | null; username?: string }) {
  return (u?.fullName && u.fullName.trim()) || u?.username || "";
}

function Avatar({ user, size = 40 }: { user?: UserBrief; size?: number }) {
  const url = user?.avatar || "";
  const name = displayName(user);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 999,
        overflow: "hidden", display: "grid", placeItems: "center",
        background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.15)",
        flex: "0 0 auto"
      }}
      aria-label={name}
      title={name}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <User size={Math.max(18, Math.floor(size * 0.55))} />
      )}
    </div>
  );
}

function UserChip({ user }: { user?: UserBrief }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <Avatar user={user} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.2,
            fontSize: 15,
          }}
        >
          {displayName(user)}
        </div>
        {user?.username && (
          <div
            className="muted"
            style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            @{user.username}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============== Page ============== */
export default function AdminMessagesManage() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());
  const mounted = useRef(true);

  // ===== data
  const [serverItems, setServerItems] = useState<MessageItem[]>([]);
  const [allItems, setAllItems] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ===== ui
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(1); // 1-based
  const [pageSize, setPageSize] = useState(10);

  // ===== modal (CREATE only)
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [senderId, setSenderId] = useState<number | "">("");
  const [receiverId, setReceiverId] = useState<number | "">("");
  const [content, setContent] = useState("");

  // user options
  const [userOptions, setUserOptions] = useState<UserBrief[]>([]);
  const [userKeyword, setUserKeyword] = useState("");

  const searchMode = query.trim().length > 0;

  /* ---------- Loaders ---------- */
  async function loadUsers(keyword = "") {
    try {
      const res = await http.get("/Users/search", { params: { query: keyword, pageIndex: 1, pageSize: 50 } });
      const items: UserBrief[] = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setUserOptions(items);
    } catch { /* ignore */ }
  }

  async function loadInboxPage(pi = pageIndex, ps = pageSize) {
    setLoading(true); setErr(null);
    try {
      const res = await http.get("/Messages/inbox", { params: { pageIndex: pi, pageSize: ps } });
      const list: MessageItem[] = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      setServerItems(list);
    } catch {
      setErr("Không tải được tin nhắn.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function loadInboxAll() {
    setLoading(true); setErr(null);
    try {
      const res = await http.get("/Messages/inbox", { params: { pageIndex: 1, pageSize: 100000 } });
      const list: MessageItem[] = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      setAllItems(list);
    } catch {
      setErr("Không tải được tin nhắn.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth) {
      nav("/login", { replace: true });
      return;
    }
    mounted.current = true;
    setSenderId(auth.userId ?? "");
    loadUsers("");
    loadInboxPage(1, pageSize);
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pageSize / searchMode thay đổi
  useEffect(() => {
    setPageIndex(1);
    if (searchMode) loadInboxAll();
    else loadInboxPage(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, searchMode]);

  // query thay đổi
  useEffect(() => {
    const q = query.trim();
    setPageIndex(1);
    if (q) loadInboxAll();
    else loadInboxPage(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /* ---------- Derived ---------- */
  let totalCount = 0;
  let pageItems: MessageItem[] = [];
  let hasPrev = pageIndex > 1;
  let hasNext = false;

  if (searchMode) {
    const filtered = allItems.filter((m) => {
      const t = [
        m.content,
        m.sender?.fullName, m.sender?.username,
        m.receiver?.fullName, m.receiver?.username,
      ].join(" ").toLowerCase();
      return t.includes(query.toLowerCase());
    });
    totalCount = filtered.length;
    const offset = (pageIndex - 1) * pageSize;
    pageItems = filtered.slice(offset, offset + pageSize);
    hasNext = offset + pageSize < totalCount;
  } else {
    totalCount = serverItems.length; // count hiển thị cho trang hiện tại
    pageItems = serverItems;
    hasNext = serverItems.length === pageSize;
  }

  const maxPage = searchMode ? Math.max(1, Math.ceil(totalCount / pageSize)) : undefined;

  /* ---------- Modal (create) ---------- */
  function openCreate() {
    setReceiverId("");
    setContent("");
    setOpen(true);
  }
  function closeModal() { setOpen(false); }

  const canSubmit = useMemo(() => {
    const sOk = typeof senderId === "number" && senderId > 0;
    const rOk = typeof receiverId === "number" && receiverId > 0;
    return sOk && rOk && content.trim().length > 0;
  }, [senderId, receiverId, content]);

  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    setSending(true); setErr(null);
    try {
      await http.post(
        "/Messages",
        { receiverId: Number(receiverId), content: content.trim() },
        { params: { uid: Number(senderId) } }
      );
      closeModal();
      if (searchMode) await loadInboxAll();
      else await loadInboxPage(1, pageSize);
      setPageIndex(1);
    } catch {
      setErr("Gửi tin thất bại. Vui lòng kiểm tra dữ liệu.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMsg(m: MessageItem) {
    if (!confirm(`Xoá tin của ${displayName(m.sender)} → ${displayName(m.receiver)}?`)) return;
    try {
      await http.delete(`/Messages/${m.id}`);
      if (searchMode) {
        const remain = pageItems.length - 1;
        const newPi = remain > 0 ? pageIndex : Math.max(1, pageIndex - 1);
        setPageIndex(newPi);
        await loadInboxAll();
      } else {
        if (pageItems.length === 1 && pageIndex > 1) {
          const prev = pageIndex - 1;
          setPageIndex(prev);
          await loadInboxPage(prev, pageSize);
        } else {
          await loadInboxPage(pageIndex, pageSize);
        }
      }
    } catch {
      alert("Xoá thất bại.");
    }
  }

  /* ---------- UI ---------- */
  function handleBack() {
    if (window.history.length > 1) nav(-1);
    else nav("/admin", { replace: true });
  }

  return (
    <div className="give-wrap">
      {/* Mobile-first sticky header */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 30,
          backdropFilter: "saturate(1.4) blur(6px)",
          background: "rgba(18,18,20,.85)",
          borderBottom: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div className="container" style={{ padding: 12 }}>
          {/* top row */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
            <button
              onClick={handleBack}
              aria-label="Quay lại"
              className="btn btn-ghost"
              style={{ padding: 8, minHeight: 44, minWidth: 44 }}
            >
              <ArrowLeftCircle size={24} />
            </button>

            {/* search full-width */}
            <form onSubmit={(e) => { e.preventDefault(); }} style={{ position: "relative" }}>
              <input
                className="input"
                placeholder="Tìm nội dung / người gửi / người nhận…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingRight: 40, minHeight: 44, fontSize: 16 }}
                inputMode="search"
              />
              {query && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setQuery("")}
                  aria-label="Xoá tìm"
                  style={{
                    position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                    height: 36, width: 36, display: "grid", placeItems: "center"
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </form>

            {/* compact action (hidden on desktop? mobile-first ưu tiên nút to) */}
            <button
              className="btn btn-primary"
              onClick={openCreate}
              aria-label="Gửi tin"
              style={{ minHeight: 44, minWidth: 44, display: "grid", placeItems: "center" }}
            >
              <Plus size={20} />
            </button>
          </div>

          {/* sub row: title + meta */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
              <Mail size={16} /> Tin nhắn
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {searchMode ? <>Tổng: <b>{allItems.length.toLocaleString()}</b></> : <>Trang <b>{pageIndex}</b></>}
            </div>
          </div>
        </div>
      </header>

      {/* page-size selector (scrolls with page) */}
      <div className="container" style={{ padding: 12 }}>
        <div
          className="card"
          style={{
            padding: 10,
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span className="muted" style={{ fontSize: 13 }}>Số dòng / trang</span>
          <select
            className="input"
            value={pageSize}
            onChange={(e) => { const ps = Number(e.target.value) || 10; setPageSize(ps); }}
            style={{ width: 120, minHeight: 40 }}
            aria-label="Chọn số dòng mỗi trang"
          >
            {[5, 10, 20, 50].map(n => <option key={n} value={n} style={{ color: "#000" }}>{n}/trang</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <main className="container" style={{ padding: 12 }}>
        <section className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="muted" style={{ padding: 14, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={18} className="spin" /> Đang tải…
            </div>
          ) : err ? (
            <div className="error" style={{ padding: 14 }}>{err}</div>
          ) : !pageItems.length ? (
            <div className="muted" style={{ padding: 14 }}>Không có tin nhắn.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {pageItems.map(m => (
                <li key={m.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                  <div style={{ padding: 12, display: "grid", gap: 10 }}>
                    {/* Sender -> Receiver + time */}
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <UserChip user={m.sender} />
                        <span className="muted" style={{ fontSize: 12, flex: "0 0 auto" }}>→</span>
                        <UserChip user={m.receiver} />
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {formatTime(m.createdAt)}
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ fontWeight: 600, lineHeight: 1.5, whiteSpace: "pre-wrap", fontSize: 15 }}>
                      {m.content}
                    </div>

                    {/* Actions (large tap targets) */}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => deleteMsg(m)}
                        style={{ minHeight: 44, paddingInline: 14 }}
                        aria-label={`Xoá tin của ${displayName(m.sender)} tới ${displayName(m.receiver)}`}
                      >
                        <Trash2 size={18} /> <span>Xoá</span>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pagination */}
        <nav
          className="card"
          aria-label="Phân trang"
          style={{
            padding: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginTop: 12
          }}
        >
          <button
            className="btn"
            onClick={() => {
              if (pageIndex <= 1) return;
              const p = pageIndex - 1;
              setPageIndex(p);
              if (!searchMode) loadInboxPage(p, pageSize);
            }}
            disabled={pageIndex <= 1}
            style={{ minHeight: 44, minWidth: 100 }}
          >
            Trước
          </button>

          <div className="muted" style={{ fontSize: 14 }}>
            Trang <b>{pageIndex}</b>
            {searchMode && maxPage ? <> / <b>{maxPage}</b></> : null}
          </div>

          <button
            className="btn"
            onClick={() => {
              const canNext = searchMode ? (pageIndex < (maxPage || 1)) : (serverItems.length === pageSize);
              if (!canNext) return;
              const p = pageIndex + 1;
              setPageIndex(p);
              if (!searchMode) loadInboxPage(p, pageSize);
            }}
            disabled={searchMode ? pageIndex >= (maxPage || 1) : serverItems.length < pageSize}
            style={{ minHeight: 44, minWidth: 100 }}
          >
            Sau
          </button>
        </nav>
      </main>

      {/* Floating Action Button (mobile) */}
      {/* <button
        onClick={openCreate}
        aria-label="Gửi tin nhắn"
        style={{
          position: "fixed", right: 16, bottom: 16, zIndex: 40,
          width: 56, height: 56, borderRadius: 999,
          display: "grid", placeItems: "center",
          border: "1px solid rgba(255,255,255,.2)",
          boxShadow: "0 10px 24px rgba(0,0,0,.45)",
          background: "var(--btn-primary, #2563eb)", color: "#fff",
        }}
      >
        <Plus size={22} />
      </button> */}

      {/* Bottom-sheet: Create only */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.55)",
            display: "grid", gridTemplateRows: "1fr auto",
          }}
        >
          <div />
          <div
            className="card"
            style={{
              borderTopLeftRadius: 18, borderTopRightRadius: 18,
              borderTop: "1px solid rgba(255,255,255,.2)",
              background: "rgba(20,22,28,.98)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Gửi tin nhắn</div>
              <button className="btn btn-ghost" onClick={() => setOpen(false)} style={{ minHeight: 44 }}>
                <X size={16} /> Đóng
              </button>
            </div>

            <form onSubmit={submitForm} style={{ display: "grid", gap: 12, marginTop: 10 }}>
              <div>
                <label className="label">Người gửi</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <select
                    className="input"
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value ? Number(e.target.value) : "")}
                    required
                    style={{ minHeight: 44 }}
                  >
                    <option value="" style={{ color: "#000" }}>(Chọn người gửi)</option>
                    {userOptions.map(u => (
                      <option key={u.id} value={u.id} style={{ color: "#000" }}>
                        {displayName(u)} (@{u.username})
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn" onClick={() => loadUsers(userKeyword)} style={{ minHeight: 44 }}>
                    <Search size={16} /> Nạp
                  </button>
                </div>
                <input
                  className="input"
                  placeholder="Tìm nhanh người gửi…"
                  value={userKeyword}
                  onChange={(e) => setUserKeyword(e.target.value)}
                  style={{ marginTop: 8, minHeight: 44 }}
                />
              </div>

              <div>
                <label className="label">Người nhận</label>
                <select
                  className="input"
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value ? Number(e.target.value) : "")}
                  required
                  style={{ minHeight: 44 }}
                >
                  <option value="" style={{ color: "#000" }}>(Chọn người nhận)</option>
                  {userOptions.map(u => (
                    <option key={u.id} value={u.id} style={{ color: "#000" }}>
                      {displayName(u)} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Nội dung</label>
                <textarea
                  className="input"
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung…"
                  maxLength={1000}
                  required
                  style={{ resize: "vertical", minHeight: 120, lineHeight: 1.45 }}
                />
              </div>

              {err && <div className="error">{err}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => setOpen(false)} style={{ minHeight: 44 }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={sending || !canSubmit} style={{ minHeight: 44 }}>
                  {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />} Gửi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
