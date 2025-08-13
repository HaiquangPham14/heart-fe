import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftCircle, Search, Plus, Trash2, Save, X, Loader2,
  User, Users as UsersIcon, ShieldCheck,
} from "lucide-react";
import http from "../../lib/http";
import { getAuth, API_BASE_URL } from "../../lib/auth";

type BriefUser = { id: number; username: string; fullName?: string | null };
type BriefTeam = { id: number; name: string; description?: string | null };

type AdjustmentDto = {
  id: number;
  amount: number;
  reason?: string | null;
  createdAt?: string | null;
  admin: BriefUser;
  targetUser?: BriefUser | null;
  targetTeam?: BriefTeam | null;
};

type PagedRes<T> = { items: T[]; pageIndex?: number; pageSize?: number; total?: number };

function normalizePaged<T>(raw: any): PagedRes<T> {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
    ? raw.data
    : [];
  const pageIndex = Number(raw?.pageIndex ?? 1);
  const pageSize = Number(raw?.pageSize ?? 0) || undefined;
  const total = Number(raw?.total ?? raw?.count ?? arr.length) || arr.length;
  return { items: arr as T[], pageIndex, pageSize, total };
}

/* ====== detect admin robustly (local + JWT claims) ====== */
function safeAtobUrl(b64url: string) {
  try {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
    return typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  } catch { return ""; }
}
function extractRolesFromToken(token?: string): string[] {
  if (!token) return [];
  const parts = token.split(".");
  if (parts.length < 2) return [];
  const json = safeAtobUrl(parts[1]);
  try {
    const payload = JSON.parse(json) || {};
    const keys = [
      "role", "roles",
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role",
    ];
    let vals: any[] = [];
    for (const k of keys) {
      const v = (payload as any)[k];
      if (Array.isArray(v)) vals.push(...v);
      else if (typeof v === "string") vals.push(...v.split(/[,\s]+/));
    }
    return vals.map((s) => s?.toString().toLowerCase()).filter(Boolean);
  } catch { return []; }
}
function isAdminUser(auth: any): boolean {
  const localRolesRaw = [auth?.roles, auth?.role, auth?.Roles, auth?.Role].filter(Boolean);
  let localRoles: string[] = [];
  for (const v of localRolesRaw) {
    if (Array.isArray(v)) localRoles.push(...v);
    else if (typeof v === "string") localRoles.push(...v.split(/[,\s]+/));
  }
  localRoles = localRoles.map((s) => s?.toString().toLowerCase()).filter(Boolean);

  const tokenRoles = extractRolesFromToken(auth?.token);
  const all = new Set<string>([...localRoles, ...tokenRoles]);
  return all.has("admin");
}
/* ======================================================== */

export default function AdminAdjustmentsManage() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());
  const mounted = useRef(true);

  // list state
  const [rawItems, setRawItems] = useState<AdjustmentDto[]>([]);
  const [serverPaged, setServerPaged] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | undefined>(undefined);

  // ui state
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // picker data
  const [teamOptions, setTeamOptions] = useState<BriefTeam[]>([]);
  const [userOptions, setUserOptions] = useState<BriefUser[]>([]);

  // modal state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetType, setTargetType] = useState<"user" | "team">("user");
  const [targetId, setTargetId] = useState<number | "">("");
  const [amount, setAmount] = useState<number | string>(""); // allow "-" temporary
  const [reason, setReason] = useState("");

  // derived
  const totalCount = serverTotal ?? rawItems.length;
  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (pageIndex - 1) * pageSize;

  const filtered = useMemo(() => {
    if (!query.trim()) return rawItems;
    const q = query.toLowerCase();
    return rawItems.filter((x) => {
      const pieces = [
        x.reason ?? "",
        x.admin?.fullName ?? "",
        x.admin?.username ?? "",
        x.targetUser?.fullName ?? "",
        x.targetUser?.username ?? "",
        x.targetTeam?.name ?? "",
      ].join(" ").toLowerCase();
      return pieces.includes(q);
    });
  }, [rawItems, query]);

  const pageItems = useMemo(() => {
    if (serverPaged) return filtered; // filtered đã là 1 trang từ server
    return filtered.slice(offset, offset + pageSize);
  }, [filtered, serverPaged, offset, pageSize]);

  const canSubmit = useMemo(() => {
    const isNum = typeof amount === "number";
    const amtOk = isNum && Number.isInteger(amount as number) && (amount as number) !== 0;
    const tgtOk = typeof targetId === "number" && targetId > 0;
    return amtOk && tgtOk;
  }, [amount, targetId]);

  function resetForm() {
    setTargetType("user");
    setTargetId("");
    setAmount("");
    setReason("");
  }
  function openCreate() {
    resetForm();
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
  }

  async function loadTeams() {
    try {
      const res = await http.get("/Teams", { params: { pageIndex: 1, pageSize: 1000 } });
      const items: BriefTeam[] = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setTeamOptions(items);
    } catch { /* ignore */ }
  }
  async function searchUsers(keyword = "") {
    try {
      const res = await http.get("/Users/search", { params: { query: keyword, pageIndex: 1, pageSize: 20 } });
      const items: BriefUser[] = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setUserOptions(items);
    } catch { /* ignore */ }
  }

  async function loadAdjustments(pi = pageIndex, ps = pageSize) {
    setLoading(true); setErr(null);
    try {
      const res = await http.get("/HeartAdjustments", { params: { pageIndex: pi, pageSize: ps } });
      const pg = normalizePaged<AdjustmentDto>(res.data);
      const hdrTotal = Number(res.headers?.["x-total-count"]) || undefined;
      const isServerPaged = Boolean(pg.pageIndex || pg.pageSize || pg.total || hdrTotal);

      setServerPaged(isServerPaged);
      setRawItems(pg.items);
      setServerTotal(pg.total ?? hdrTotal ?? (isServerPaged ? undefined : pg.items.length));
      setPageIndex(isServerPaged ? (pg.pageIndex || pi) : pi);
      setPageSize(ps);
    } catch {
      setErr("Không tải được danh sách thưởng/phạt.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  // --- POST fallback cho các route phổ biến nếu bị 404 ---
  async function postAdjustmentWithFallback(body: any) {
    const candidates = [
      "/HeartAdjustments",
      "/HeartAdjustments/create",
      "/heartadjustments",
      "/heartadjustments/create",
      // absolute (trong trường hợp http.baseURL thiếu /api):
      `${API_BASE_URL.replace(/\/$/, "")}/HeartAdjustments`,
    ];

    let lastErr: any = null;
    for (const url of candidates) {
      try {
        const res = await http.post(url, body);
        return res;
      } catch (e: any) {
        lastErr = e;
        // nếu không phải 404, ném luôn (lỗi xác thực, 400,…)
        const status = e?.response?.status;
        if (status && status !== 404) throw e;
      }
    }
    throw lastErr;
  }

  async function createAdjustment(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    setSaving(true); setErr(null);
    try {
      // BE của bạn nhận PascalCase/Case-insensitive – gửi PascalCase cho chắc
      const body: any = {
        Amount: Number(amount),
        Reason: reason.trim() || null,
      };
      if (targetType === "user") body.TargetUserId = Number(targetId);
      else body.TargetTeamId = Number(targetId);

      await postAdjustmentWithFallback(body); // ✅ dùng fallback để tránh 404 route

      closeModal();
      await loadAdjustments(1, pageSize);
    } catch (e: any) {
      // Nếu BE insert thành công nhưng trả 500 do CreatedAtAction, mình vẫn reload
      try {
        await loadAdjustments(1, pageSize);
        closeModal();
        return;
      } catch {
        const msg = e?.response?.status === 404
          ? "Không tìm thấy endpoint tạo thưởng/phạt. Kiểm tra lại route ở BE (HeartAdjustmentsController)."
          : "Tạo thưởng/phạt thất bại. Kiểm tra dữ liệu hoặc quyền admin.";
        setErr(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteAdjustment(item: AdjustmentDto) {
    const ok = window.confirm(`Xoá phiếu ${item.amount > 0 ? "thưởng" : "phạt"} #${item.id}?`);
    if (!ok) return;
    try {
      await http.delete(`/HeartAdjustments/${item.id}`);
      if (serverPaged) {
        const remain = pageItems.length - 1;
        const newPi = remain > 0 ? pageIndex : Math.max(1, pageIndex - 1);
        await loadAdjustments(newPi, pageSize);
      } else {
        await loadAdjustments(1, pageSize);
        setPageIndex(1);
      }
    } catch {
      alert("Xoá thất bại.");
    }
  }

  function handleBack() {
    if (window.history.length > 1) nav(-1);
    else nav("/admin", { replace: true });
  }

  useEffect(() => {
    if (!auth) { nav("/login", { replace: true }); return; }
    if (!isAdminUser(auth)) {
      console.warn("User không có role 'admin' theo FE (BE sẽ chặn ở API nếu không có quyền).");
    }
    mounted.current = true;
    loadTeams();
    searchUsers("");
    loadAdjustments(1, pageSize);
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="give-wrap">
      <div className="container">
        {/* Back */}
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

        {/* Header + actions */}
        <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={18} />
              <div style={{ fontWeight: 800, fontSize: 18 }}>Quản lý Thưởng/Phạt</div>
            </div>
            <div className="muted">Tổng: <b>{(serverTotal ?? rawItems.length).toLocaleString()}</b></div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <form
              onSubmit={(e) => { e.preventDefault(); }}
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}
            >
              <input
                className="input"
                placeholder="Tìm theo lý do, người/đội…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Search size={16} /> Tìm
              </button>
            </form>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <select
                className="input"
                value={pageSize}
                onChange={(e) => {
                  const ps = Number(e.target.value) || 10;
                  setPageSize(ps);
                  loadAdjustments(serverPaged ? pageIndex : 1, ps);
                  if (!serverPaged) setPageIndex(1);
                }}
                title="Số dòng / trang"
                style={{ background: "rgba(255,255,255,.06)", color: "var(--w-90, #fff)", border: "1px solid rgba(255,255,255,.22)" }}
              >
                {[5, 10, 20, 50].map(n => <option key={n} value={n} style={{ color: "#000" }}>{n}/trang</option>)}
              </select>

              <button className="btn" onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Plus size={16} /> Thêm thưởng/phạt
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="card" style={{ padding: 8 }}>
          {loading ? (
            <div className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={16} className="spin" /> Đang tải…
            </div>
          ) : err ? (
            <div className="error">{err}</div>
          ) : pageItems.length === 0 ? (
            <div className="muted">Không có phiếu thưởng/phạt.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {pageItems.map((a) => {
                const isUser = !!a.targetUser;
                const isBonus = a.amount > 0;
                const targetLabel = isUser
                  ? `${a.targetUser?.fullName || a.targetUser?.username} (@${a.targetUser?.username})`
                  : `${a.targetTeam?.name}`;
                const date = a.createdAt ? new Date(a.createdAt) : null;
                return (
                  <li key={a.id} className="card" style={{ padding: 10 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <div
                            style={{
                              width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center",
                              background: isUser ? "rgba(99,102,241,.18)" : "rgba(16,185,129,.18)",
                              border: `1px solid ${isUser ? "rgba(99,102,241,.5)" : "rgba(16,185,129,.5)"}`
                            }}
                          >
                            {isUser ? <User size={16} /> : <UsersIcon size={16} />}
                          </div>
                          <div style={{ display: "grid" }}>
                            <div style={{ fontWeight: 700, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{targetLabel}</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              bởi {a.admin?.fullName || a.admin?.username} · {date ? date.toLocaleString() : ""}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            padding: "4px 10px", borderRadius: 999,
                            background: isBonus ? "rgba(34,197,94,.18)" : "rgba(244,63,94,.18)",
                            border: `1px solid ${isBonus ? "rgba(34,197,94,.5)" : "rgba(244,63,94,.5)"}`
                          }}
                          aria-label="Số tim điều chỉnh"
                        >
                          <b>{a.amount > 0 ? `+${a.amount}` : `${a.amount}`}</b>
                        </div>
                      </div>

                      {a.reason && <div className="muted" style={{ fontSize: 12 }}>Lý do: {a.reason}</div>}

                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button className="btn btn-ghost" onClick={() => deleteAdjustment(a)} aria-label="Xoá">
                          <Trash2 size={16} /> <span>Xoá</span>
                        </button>
                      </div>
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
              if (serverPaged) {
                setPageIndex(p);
                loadAdjustments(p, pageSize);
              } else {
                setPageIndex(p);
              }
            }}
            disabled={pageIndex <= 1}
          >
            Trước
          </button>

          <div className="muted">Trang <b>{pageIndex}</b> / <b>{maxPage}</b></div>

          <button
            className="btn"
            onClick={() => {
              const p = Math.min(maxPage, pageIndex + 1);
              if (serverPaged) {
                setPageIndex(p);
                loadAdjustments(p, pageSize);
              } else {
                setPageIndex(p);
              }
            }}
            disabled={pageIndex >= maxPage}
          >
            Sau
          </button>
        </div>
      </div>

      {/* Modal tạo thưởng/phạt */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", padding: 12, zIndex: 30, backdropFilter: "blur(2px)" }}
        >
          <div className="card" style={{ width: "100%", maxWidth: 520, padding: 14, background: "rgba(20,22,28,.96)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Thêm thưởng/phạt</div>
              <button className="btn btn-ghost" onClick={closeModal}><X size={16} /> Đóng</button>
            </div>

            <form onSubmit={createAdjustment} style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div>
                <label className="label">Áp dụng cho</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => { setTargetType("user"); setTargetId(""); }}
                    aria-pressed={targetType === "user"}
                    style={{ borderColor: targetType === "user" ? "var(--primary,#60a5fa)" : undefined }}
                  >
                    <User size={14} /> Người dùng
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => { setTargetType("team"); setTargetId(""); }}
                    aria-pressed={targetType === "team"}
                    style={{ borderColor: targetType === "team" ? "var(--primary,#60a5fa)" : undefined }}
                  >
                    <UsersIcon size={14} /> Team
                  </button>
                </div>
              </div>

              {targetType === "user" ? (
                <div>
                  <label className="label">Người dùng</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                    <select
                      className="input"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : "")}
                      required
                      style={{ background: "rgba(255,255,255,.06)", color: "var(--w-90,#fff)", border: "1px solid rgba(255,255,255,.22)" }}
                    >
                      <option value="" style={{ color: "#000" }}>(Chọn người dùng)</option>
                      {userOptions.map(u => (
                        <option key={u.id} value={u.id} style={{ color: "#000" }}>
                          {u.fullName || u.username} (@{u.username})
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn" onClick={() => searchUsers("")}><Search size={16} /> Nạp</button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="label">Team</label>
                  <select
                    className="input"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : "")}
                    required
                    style={{ background: "rgba(255,255,255,.06)", color: "var(--w-90,#fff)", border: "1px solid rgba(255,255,255,.22)" }}
                  >
                    <option value="" style={{ color: "#000" }}>(Chọn team)</option>
                    {teamOptions.map(t => (
                      <option key={t.id} value={t.id} style={{ color: "#000" }}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Số tim (âm = phạt, dương = thưởng)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    // Cho phép "", "-", "-123", "123"
                    const v = e.target.value.replace(/\s+/g, "");
                    if (v === "" || v === "-" || /^-?\d+$/.test(v)) {
                      setAmount(v === "" || v === "-" ? v : Number(v));
                    }
                  }}
                  placeholder="+5 hoặc -3"
                  required
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.22)", color: "var(--w-90,#fff)" }}
                />
              </div>

              <div>
                <label className="label">Lý do (tuỳ chọn)</label>
                <input
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={255}
                  placeholder="VD: Hoàn thành mục tiêu sprint"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.22)", color: "var(--w-90,#fff)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn" onClick={closeModal}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={!canSubmit || saving} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
