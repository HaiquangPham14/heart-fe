// src/pages/admin/AdminNotificationsManage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftCircle, Bell, CalendarClock, Loader2, Plus, Save, Search, X, Edit2, Trash2, Clock4, SendHorizonal
} from "lucide-react";
import http from "../../lib/http";
import { getAuth, API_BASE_URL } from "../../lib/auth";

/* -------------------- Types -------------------- */
type BriefUser = { id: number; username?: string; fullName?: string | null };

type NotificationDto = {
  id: number;
  title?: string | null; Title?: string | null;
  content?: string | null; Content?: string | null;
  scheduledTime?: string | null; ScheduledTime?: string | null;
  sentAt?: string | null; SentAt?: string | null;
  createdAt?: string | null; CreatedAt?: string | null;
  sender?: BriefUser | null; Sender?: BriefUser | null;
};

type PagedRes<T> = { items: T[]; pageIndex?: number; pageSize?: number; total?: number };

function normalizePaged<T>(raw: any): PagedRes<T> {
  const items: T[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
    ? raw.data
    : [];
  const pageIndex = Number(raw?.pageIndex ?? 1);
  const pageSize = Number(raw?.pageSize ?? 0) || undefined;
  const total = Number(raw?.total ?? raw?.count ?? items.length) || items.length;
  return { items, pageIndex, pageSize, total };
}

/* -------------------- Helpers -------------------- */
function pickTitle(n: NotificationDto) {
  return (n.title ?? n.Title ?? "").toString();
}
function pickContent(n: NotificationDto) {
  return (n.content ?? n.Content ?? "").toString();
}
function pickScheduled(n: NotificationDto) {
  return (n.scheduledTime ?? n.ScheduledTime ?? "") || null;
}
function pickCreated(n: NotificationDto) {
  return (n.createdAt ?? n.CreatedAt ?? "") || null;
}
function pickSent(n: NotificationDto) {
  return (n.sentAt ?? n.SentAt ?? "") || null;
}
function fmtTime(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleString();
}
function ts(s?: string | null) {
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : 0;
}
function isoToLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // to yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}
function nowLocalInput() {
  return isoToLocalInput(new Date().toISOString());
}

/* Fallbacks (một số backend mount route khác nhau) */
async function getWithFallback(url: string, params?: any) {
  const tries = [url, url.toLowerCase(), `${API_BASE_URL.replace(/\/$/, "")}${url}`];
  let last: any;
  for (const u of tries) {
    try { return await http.get(u, { params }); }
    catch (e: any) { last = e; if (e?.response?.status && e.response.status !== 404) throw e; }
  }
  throw last;
}
async function postWithFallback(url: string, body: any) {
  const tries = [url, url.toLowerCase(), `${API_BASE_URL.replace(/\/$/, "")}${url}`];
  let last: any;
  for (const u of tries) {
    try { return await http.post(u, body); }
    catch (e: any) { last = e; if (e?.response?.status && e.response.status !== 404) throw e; }
  }
  throw last;
}
async function putWithFallback(url: string, body: any) {
  const tries = [url, url.toLowerCase(), `${API_BASE_URL.replace(/\/$/, "")}${url}`];
  let last: any;
  for (const u of tries) {
    try { return await http.put(u, body); }
    catch (e: any) { last = e; if (e?.response?.status && e.response.status !== 404) throw e; }
  }
  throw last;
}
async function deleteWithFallback(url: string) {
  const tries = [url, url.toLowerCase(), `${API_BASE_URL.replace(/\/$/, "")}${url}`];
  let last: any;
  for (const u of tries) {
    try { return await http.delete(u); }
    catch (e: any) { last = e; if (e?.response?.status && e.response.status !== 404) throw e; }
  }
  throw last;
}

/* =================================================== */
export default function AdminNotificationsManage() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());

  // list state
  const [raw, setRaw] = useState<NotificationDto[]>([]);
  const [serverPaged, setServerPaged] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | undefined>(undefined);

  // ui state
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "old">("all"); // "all" = tất cả, "old" = thông báo cũ (đã qua lịch/đã gửi)
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // modal (create & edit)
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<NotificationDto | null>(null);

  // form fields
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduleLocal, setScheduleLocal] = useState<string>(""); // yyyy-MM-ddTHH:mm (local)
  // cho phép chỉnh CreatedAt / SentAt khi EDIT
  const [createdLocal, setCreatedLocal] = useState<string>("");
  const [sentLocal, setSentLocal] = useState<string>("");

  const mounted = useRef(true);

  useEffect(() => {
    if (!auth) {
      nav("/login", { replace: true });
      return;
    }
    mounted.current = true;
    loadList(1, pageSize);
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadList(pi = pageIndex, ps = pageSize) {
    setLoading(true);
    setErr(null);
    try {
      // BE: [HttpGet] /Notifications (pageIndex, pageSize)
      const res = await getWithFallback("/Notifications", { pageIndex: pi, pageSize: ps });
      const pg = normalizePaged<NotificationDto>(res.data);
      const hdrTotal = Number(res.headers?.["x-total-count"]) || undefined;
      const isServerPaged = Boolean(pg.pageIndex || pg.pageSize || pg.total || hdrTotal);

      setServerPaged(isServerPaged);
      setRaw(pg.items);
      setServerTotal(pg.total ?? hdrTotal ?? (isServerPaged ? undefined : pg.items.length));
      setPageIndex(isServerPaged ? (pg.pageIndex || pi) : pi);
      setPageSize(ps);
    } catch (e) {
      setErr("Không tải được danh sách thông báo.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    let arr = raw.slice();

    if (tab === "old") {
      arr = arr.filter(n => {
        const sent = ts(pickSent(n));
        const sch = ts(pickScheduled(n));
        // "cũ": đã sent hoặc (có lịch và lịch <= now)
        return (sent && sent > 0) || (sch && sch > 0 && sch <= now);
      });
    }

    if (!q) return arr;
    return arr.filter(n => {
      const text = `${pickTitle(n)} ${pickContent(n)}`.toLowerCase();
      return text.includes(q);
    });
  }, [raw, query, tab]);

  const totalCount = serverTotal ?? filtered.length;
  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (pageIndex - 1) * pageSize;
  const pageItems = serverPaged ? filtered : filtered.slice(offset, offset + pageSize);

  function handleBack() {
    if (window.history.length > 1) nav(-1);
    else nav("/admin", { replace: true });
  }

  /* ======== Modal helpers ======== */
  function openCreate() {
    setEditing(null);
    setTitle("");
    setContent("");
    setScheduleMode("now");
    setScheduleLocal("");
    setCreatedLocal(nowLocalInput());  // create: mặc định now (ẩn trong UI)
    setSentLocal("");                  // create: để rỗng, sẽ set theo scheduleMode
    setOpen(true);
  }

  function openEdit(n: NotificationDto) {
    setEditing(n);
    setTitle(pickTitle(n));
    setContent(pickContent(n));
    const sch = pickScheduled(n);
    setScheduleMode(sch ? "later" : "now");
    setScheduleLocal(isoToLocalInput(sch));
    setCreatedLocal(isoToLocalInput(pickCreated(n)) || nowLocalInput());
    setSentLocal(isoToLocalInput(pickSent(n)));
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  function toIsoFromLocal(dtLocal: string): string | null {
    if (!dtLocal) return null;
    // dtLocal format: "yyyy-MM-ddTHH:mm"
    const d = new Date(dtLocal);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  /* ======== Create / Update ======== */
  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim()) { setErr("Vui lòng nhập tiêu đề."); return; }
    setSaving(true); setErr(null);

    try {
      const nowIso = new Date().toISOString();

      // base payload
      const payload: any = {
        Title: title.trim(),
        Content: (content || "").trim() || null,
      };

      if (!editing) {
        // TẠO MỚI
        payload.CreatedAt = nowIso; // luôn now

        if (scheduleMode === "now") {
          payload.ScheduledTime = nowIso;
          payload.SentAt = nowIso;
        } else {
          const schIso = toIsoFromLocal(scheduleLocal);
          if (!schIso) throw new Error("Thời gian lên lịch không hợp lệ.");
          payload.ScheduledTime = schIso;
          payload.SentAt = null;
        }

        await postWithFallback("/Notifications", payload);
      } else {
        // UPDATE (update tất cả trừ SenderId)
        // CreatedAt & SentAt có thể sửa ở form; nếu để trống -> không gửi (BE giữ nguyên)
        if (createdLocal) payload.CreatedAt = toIsoFromLocal(createdLocal);
        if (sentLocal || sentLocal === "") payload.SentAt = sentLocal ? toIsoFromLocal(sentLocal) : null;

        if (scheduleMode === "now") {
          // Nếu chọn "Gửi ngay" khi edit -> đồng bộ theo yêu cầu
          payload.ScheduledTime = nowIso;
          payload.SentAt = nowIso;
        } else {
          // Hẹn giờ
          const schIso = toIsoFromLocal(scheduleLocal);
          if (schIso) payload.ScheduledTime = schIso;
          else payload.ScheduledTime = null; // nếu xóa input -> clear lịch
          // SentAt giữ theo input (nếu người dùng muốn xoá/giữ), không auto set ở đây
        }

        await putWithFallback(`/Notifications/${editing.id}`, payload);
      }

      closeModal();
      await loadList(1, pageSize);
      setPageIndex(1);
    } catch (e: any) {
      setErr(
        e?.response?.status === 404
          ? "Không tìm thấy endpoint thông báo. Kiểm tra route ở BE (NotificationsController)."
          : (e?.message || "Lưu thất bại. Vui lòng kiểm tra dữ liệu.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteNoti(n: NotificationDto) {
    if (!confirm(`Xoá thông báo: "${pickTitle(n) || "(không có tiêu đề)"}"?`)) return;
    try {
      await deleteWithFallback(`/Notifications/${n.id}`);
      // cập nhật trang hợp lý
      const remain = pageItems.length - 1;
      const newPi = remain > 0 ? pageIndex : Math.max(1, pageIndex - 1);
      await loadList(newPi, pageSize);
      setPageIndex(newPi);
    } catch {
      alert("Xoá thất bại.");
    }
  }

  /* ======== Badge trạng thái ======== */
  function renderStatus(n: NotificationDto) {
    const sent = pickSent(n);
    const scheduled = pickScheduled(n);
    const now = Date.now();

    if (sent) {
      return (
        <span className="chip" title={fmtTime(sent)}>
          <SendHorizonal size={14} /> Đã gửi • {fmtTime(sent)}
        </span>
      );
    }
    if (scheduled) {
      const t = ts(scheduled);
      if (t > now) {
        return (
          <span className="chip" title={fmtTime(scheduled)}>
            <Clock4 size={14} /> Chờ gửi • {fmtTime(scheduled)}
          </span>
        );
      }
      // đã qua nhưng chưa có sentAt -> coi như đã gửi
      return (
        <span className="chip" title={fmtTime(scheduled)}>
          <SendHorizonal size={14} /> Đã gửi • {fmtTime(scheduled)}
        </span>
      );
    }
    return <span className="chip">Gửi ngay</span>;
  }

  return (
    <div className="give-wrap admin-noti">
      {/* ==== Style override để nút không bị nền trắng và chữ luôn trắng ==== */}
      <style>{`
        .admin-noti .btn,
        .admin-noti .btn-ghost,
        .admin-noti .btn-primary {
          color: #fff !important;
        }
        .admin-noti .btn svg,
        .admin-noti .btn-ghost svg,
        .admin-noti .btn-primary svg {
          stroke: currentColor !important;
        }

        /* Nút thường: nền trong suốt đậm nhẹ, viền mảnh */
        .admin-noti .btn {
          background: rgba(255,255,255,.06) !important;
          border: 1px solid rgba(255,255,255,.18) !important;
        }
        .admin-noti .btn:hover {
          background: rgba(255,255,255,.12) !important;
        }

        /* Nút ghost: hoàn toàn trong suốt, hover có nhấn */
        .admin-noti .btn-ghost {
          background: transparent !important;
          border: 1px solid rgba(255,255,255,.18) !important;
        }
        .admin-noti .btn-ghost:hover {
          background: rgba(255,255,255,.08) !important;
        }

        /* Nút primary: gradient rõ, chữ trắng */
        .admin-noti .btn-primary {
          background: linear-gradient(180deg, var(--brand-600, #6366f1), var(--accent-600, #a855f7)) !important;
          border: 1px solid rgba(255,255,255,.28) !important;
        }

        /* Vô hiệu hoá */
        .admin-noti .btn:disabled,
        .admin-noti .btn[disabled] {
          color: rgba(255,255,255,.65) !important;
          opacity: .75;
        }

        /* Chip trạng thái */
        .admin-noti .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.18);
          color: #fff;
          white-space: nowrap;
        }

        /* Select tối để không trùng chữ */
        .admin-noti select.input {
          background: rgba(255,255,255,.06) !important;
          color: #fff !important;
          border: 1px solid rgba(255,255,255,.22) !important;
        }
        .admin-noti select.input option { color: #000; }
      `}</style>

      <div className="container">
        <div className="page-slab" style={{ display: "grid", gap: 12 }}>
          {/* Back icon */}
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <button
              onClick={handleBack}
              aria-label="Quay lại"
              title="Quay lại"
              style={{
                width: 60, height: 60, background: "transparent", border: "none",
                display: "grid", placeItems: "center", cursor: "pointer", color: "#fff",
                filter: "drop-shadow(0 6px 12px rgba(0,0,0,.35))",
              }}
            >
              <ArrowLeftCircle size={48} strokeWidth={2.5} />
            </button>
          </div>

          {/* Header */}
          <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={18} />
                <div style={{ fontWeight: 800, fontSize: 18 }}>Quản lý Thông báo</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Plus size={16} /> Tạo thông báo
                </button>
              </div>
            </div>

            {/* Search + filter + page size */}
            <div style={{ display: "grid", gap: 8 }}>
              <form onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Tìm theo tiêu đề/nội dung…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="btn btn-primary" type="submit" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Search size={16} /> Tìm
                </button>
              </form>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => { setTab("all"); setPageIndex(1); }}
                    aria-pressed={tab === "all"}
                    style={{ borderColor: tab === "all" ? "var(--primary,#60a5fa)" : undefined }}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => { setTab("old"); setPageIndex(1); }}
                    aria-pressed={tab === "old"}
                    style={{ borderColor: tab === "old" ? "var(--primary,#60a5fa)" : undefined }}
                  >
                    Thông báo cũ
                  </button>
                </div>

                <select
                  className="input"
                  value={pageSize}
                  onChange={(e) => {
                    const ps = Number(e.target.value) || 10;
                    setPageSize(ps);
                    if (serverPaged) loadList(pageIndex, ps);
                    else setPageIndex(1);
                  }}
                  title="Số dòng / trang"
                >
                  {[5, 10, 20, 50].map(n => <option key={n} value={n} style={{ color: "#000" }}>{n}/trang</option>)}
                </select>
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
              <div className="muted">Không có thông báo.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {pageItems.map((n) => {
                  const t = pickTitle(n) || "(Không có tiêu đề)";
                  const c = pickContent(n) || "";

                  return (
                    <li key={n.id} className="card" style={{ padding: 12 }}>
                      <div style={{ display: "grid", gap: 8 }}>
                        {/* Row 1: title + status + actions */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ fontWeight: 800 }}>{t}</div>
                            <div>{renderStatus(n)}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button className="btn btn-ghost" onClick={() => openEdit(n)} title="Sửa" aria-label="Sửa">
                              <Edit2 size={16} /> <span>Sửa</span>
                            </button>
                            <button className="btn btn-ghost" onClick={() => deleteNoti(n)} title="Xoá" aria-label="Xoá">
                              <Trash2 size={16} /> <span>Xoá</span>
                            </button>
                          </div>
                        </div>

                        {/* Row 2: content */}
                        {c && <div style={{ lineHeight: 1.6 }}>{c}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Pagination */}
          <div className="card" style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <button
              className="btn"
              onClick={() => {
                const p = Math.max(1, pageIndex - 1);
                setPageIndex(p);
                if (serverPaged) loadList(p, pageSize);
              }}
              disabled={pageIndex <= 1}
            >
              Trước
            </button>
            <div className="muted">Trang <b>{pageIndex}</b> / <b>{Math.max(1, Math.ceil(totalCount / pageSize))}</b></div>
            <button
              className="btn"
              onClick={() => {
                const p = Math.min(Math.max(1, Math.ceil(totalCount / pageSize)), pageIndex + 1);
                setPageIndex(p);
                if (serverPaged) loadList(p, pageSize);
              }}
              disabled={pageIndex >= maxPage}
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Modal tạo/sửa thông báo */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", padding: 12, zIndex: 30, backdropFilter: "blur(2px)" }}
        >
          <div className="card" style={{ width: "100%", maxWidth: 560, padding: 14, background: "rgba(20,22,28,.96)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 18 }}>
                <CalendarClock size={18} /> {editing ? "Sửa thông báo" : "Soạn thông báo"}
              </div>
              <button className="btn btn-ghost" onClick={closeModal}><X size={16} /> Đóng</button>
            </div>

            <form onSubmit={submitForm} style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div>
                <label className="label">Tiêu đề</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề…"
                  required
                />
              </div>

              <div>
                <label className="label">Nội dung</label>
                <textarea
                  className="input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder="Nhập nội dung thông báo…"
                  style={{ resize: "vertical" }}
                />
              </div>

              <div>
                <label className="label">Thời gian gửi</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    aria-pressed={scheduleMode === "now"}
                    onClick={() => setScheduleMode("now")}
                    style={{ borderColor: scheduleMode === "now" ? "var(--primary,#60a5fa)" : undefined }}
                  >
                    Gửi ngay
                  </button>
                  <button
                    type="button"
                    className="btn"
                    aria-pressed={scheduleMode === "later"}
                    onClick={() => setScheduleMode("later")}
                    style={{ borderColor: scheduleMode === "later" ? "var(--primary,#60a5fa)" : undefined }}
                  >
                    Lên lịch
                  </button>
                </div>

                {scheduleMode === "later" && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      className="input"
                      type="datetime-local"
                      value={scheduleLocal}
                      onChange={(e) => setScheduleLocal(e.target.value)}
                      required={scheduleMode === "later"}
                    />
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Chọn ngày giờ theo múi giờ máy bạn.
                    </div>
                  </div>
                )}
              </div>

              {/* Chỉ hiện các trường nâng cao khi EDIT */}
              {editing && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <label className="label">Ngày tạo (CreatedAt)</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={createdLocal}
                      onChange={(e) => setCreatedLocal(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Đã gửi lúc (SentAt)</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={sentLocal}
                      onChange={(e) => setSentLocal(e.target.value)}
                      placeholder="Để trống để đặt SentAt = null"
                    />
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Xoá nội dung để đặt <b>SentAt = null</b>.
                    </div>
                  </div>
                </div>
              )}

              {err && <div className="error">{err}</div>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn" onClick={closeModal}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} {editing ? "Lưu" : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
