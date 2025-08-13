import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import http from "../lib/http";
import { API_BASE_URL, getAuth, clearAuth } from "../lib/auth";
import { Search, Heart } from "lucide-react";

type UserItem = {
  id: number;
  username: string;
  fullName?: string | null;
  FullName?: string | null;
  AvatarUrl?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
};

const AVATAR_FALLBACK =
  "https://cdn.jsdelivr.net/gh/HaiquangPham14/Droppi_ToDoListApp@main/image-Photoroom.png";

function apiOrigin(): string {
  try { const u = new URL(API_BASE_URL); return `${u.protocol}//${u.host}`; }
  catch { return API_BASE_URL.replace(/\/api\/?$/, ""); }
}
function toAbs(url?: string | null) {
  const s = (url ?? "").trim();
  if (!s) return null;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
  const base = apiOrigin();
  return `${base}${s.startsWith("/") ? s : `/${s}`}`;
}
function pickAvatar(u: UserItem) {
  return toAbs(u.AvatarUrl ?? u.avatarUrl ?? u.avatar_url) ?? AVATAR_FALLBACK;
}
function pickName(u: UserItem) {
  return (u.fullName ?? u.FullName ?? u.username ?? "").toString();
}
function pickHeartCount(data: any): number | null {
  const v = data?.heartCount ?? data?.HeartCount ?? data?.heart_count;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function HeartsGive() {
  const { id } = useParams();
  const targetId = Number(id);
  const nav = useNavigate();

  const [auth] = useState(() => getAuth());
  const didInit = useRef(false);
  const zoneRef = useRef<HTMLDivElement | null>(null);

  const [authorized, setAuthorized] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [meHearts, setMeHearts] = useState<number | null>(null);
  const [target, setTarget] = useState<UserItem | null>(null);

  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [amount, setAmount] = useState<number>(1);
  const amountRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Nếu chưa đăng nhập => về login
  useEffect(() => {
    if (!auth) nav("/login", { replace: true });
  }, [auth, nav]);

  // INIT: me + allUsers (1 lần)
  useEffect(() => {
    if (didInit.current || !auth) return;
    didInit.current = true;

    (async () => {
      try {
        const [meRes, usersRes] = await Promise.all([
          http.get(`/Users/${auth.userId}`),
          http.get(`/Users?pageIndex=1&pageSize=1000`),
        ]);
        setMeHearts(pickHeartCount(meRes.data));
        const raw: UserItem[] = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.items ?? [];
        setAllUsers(raw);
        setAuthorized(true);
      } catch (e:any) {
        setErr("Không tải được dữ liệu. Vui lòng thử lại.");
      }
    })();
  }, [auth]);

  // Tải người nhận theo id trên URL
  useEffect(() => {
    if (!auth) return;
    if (!Number.isFinite(targetId) || targetId <= 0) return;

    (async () => {
      try {
        const res = await http.get(`/Users/${targetId}`);
        setTarget(res.data);
      } catch { /* interceptor xử lý 401/403 */ }
    })();
    setSearchOpen(false);
  }, [targetId, auth]);

  // click ngoài => đóng dropdown
  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!zoneRef.current) return;
      if (!zoneRef.current.contains(ev.target as Node)) setSearchOpen(false);
    }
    if (searchOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [searchOpen]);

  // validate inline: > 0, ≤ meHearts, không tự gửi cho mình
  function validateAmountInline(val: number, isSelf: boolean) {
    const input = amountRef.current;
    if (!input) return true;
    input.setCustomValidity("");
    if (isSelf) { input.setCustomValidity("Bạn không thể gửi tim cho chính mình"); return false; }
    if (!Number.isInteger(val) || val < 1) { input.setCustomValidity("Số tim phải là số nguyên ≥ 1"); return false; }
    const maxVal = meHearts ?? Infinity;
    if (!(val <= maxVal)) { input.setCustomValidity(`Số tim phải ≤ ${meHearts}`); return false; }
    if (meHearts != null) input.max = String(meHearts); else input.removeAttribute("max");
    return true;
  }
  function onAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setAmount(v);
    const isSelf = target?.id === auth?.userId;
    validateAmountInline(v, !!isSelf);
    e.currentTarget.reportValidity();
  }

  // search client (ẩn chính mình)
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = allUsers.filter(u => u.id !== auth?.userId);
    if (!q) return base;
    return base.filter(u => {
      const n = pickName(u).toLowerCase();
      const un = (u.username ?? "").toString().toLowerCase();
      return n.includes(q) || un.includes(q);
    });
  }, [allUsers, query, auth]);

  function handleSearchSubmit(e?: React.FormEvent | React.MouseEvent) {
    if (e) e.preventDefault();
    setSearchOpen(true);
  }
  function chooseUser(u: UserItem) {
    setTarget(u);
    setSearchOpen(false);
    setQuery("");
    // Cập nhật URL để có thể refresh/share link
    // /hearts/give/:id
    // Router của bạn cần có route tương ứng
    // (ví dụ: <Route path="/hearts/give/:id" element={<HeartsGive />} />)
    nav(`/hearts/give/${u.id}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setOkMsg(null);
    if (!auth || !target) return;

    const isSelf = target.id === auth.userId;
    if (isSelf) { setErr("Bạn không thể gửi tim cho chính mình."); return; }

    const ok = amountRef.current?.checkValidity() ?? false;
    if (!ok) { amountRef.current?.reportValidity(); return; }

    try {
      setSubmitting(true);
      // ================== ĐIỂM SỬA CHÍNH ==================
      // BE nhận senderId là tham số riêng (không nằm trong body)
      // => gửi qua querystring: ?senderId=<auth.userId>
      await http.post(
        `/hearts/give?senderId=${auth.userId}`,
        {
          receiverUserId: target.id,
          amount,
          message: message?.trim() || undefined
        }
      );
      // =====================================================

      setMeHearts(prev => (prev == null ? prev : Math.max(0, prev - amount)));
      setAmount(1); setMessage("");
      setOkMsg(`Đã gửi ${amount} tim cho ${pickName(target)}.`);
      setTimeout(() => setOkMsg(null), 2000);
    } catch (e:any) {
      setErr(e?.response?.data ?? "Gửi tim thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authorized || !target) return null;

  const tName = pickName(target);
  const tAvatar = pickAvatar(target);
  const isSelf = target.id === auth?.userId;
  const disableForm = isSelf || (meHearts != null && meHearts < 1);

  return (
    <div className="give-wrap">
      <div className="container">
        <div className="page-slab">

          {/* SEARCH */}
          <div className={`search-zone ${searchOpen ? "is-open" : ""}`} ref={zoneRef}>
            <form
              className="search-wrap card"
              onSubmit={handleSearchSubmit}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                margin: "6px auto 0",
                width: "100%"
              }}
            >
              <div
                title="Số tim còn lại"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px",
                  borderRadius: 999, border: "1px solid rgba(255,255,255,.20)",
                  background: "linear-gradient(180deg, var(--brand-600), var(--accent-600))",
                  boxShadow: "0 8px 18px rgba(216,180,254,.28)", whiteSpace: "nowrap", minWidth: 64, justifyContent: "center"
                }}
              >
                <Heart size={14} />
                <strong>{meHearts ?? "—"}</strong>
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
                className="btn btn-primary"
                style={{ height: 36, minWidth: 44, padding: "0 12px" }}
              >
                <Search size={18} />
              </button>
            </form>

            {searchOpen && (
              <div className="search-dropdown">
                {searchResults.length === 0 ? (
                  <div className="no-results">Không tìm thấy người dùng phù hợp.</div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {searchResults.slice(0, 20).map(u => {
                      const name = pickName(u);
                      const av = pickAvatar(u);
                      const active = u.id === target.id;
                      return (
                        <button
                          key={u.id}
                          onClick={() => chooseUser(u)}
                          className="btn btn-ghost"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "38px 1fr auto",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 10px",
                            justifyItems: "start",
                            borderRadius: 12,
                            ...(active ? { outline: "2px solid rgba(255,255,255,.28)" } : null)
                          }}
                          type="button"
                          title={`Chọn ${name}`}
                        >
                          <img
                            src={av}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK; }}
                            alt={name}
                            style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,.18)" }}
                          />
                          <div style={{ textAlign: "left" }}>
                            <div style={{ fontWeight: 700 }}>{name}</div>
                            <div className="muted">@{u.username}</div>
                          </div>
                          {active && <span className="muted">Đang chọn</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* THÔNG TIN NGƯỜI NHẬN */}
          <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", padding: 16, marginTop: 14, marginBottom: 16, width: "100%" }}>
            <img
              src={tAvatar}
              alt={tName}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK; }}
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%", border: "1px solid rgba(255,255,255,.18)" }}
            />
            <div style={{ display: "grid" }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{tName}</div>
              <div className="muted">@{target.username}</div>
            </div>
            {target.id === auth?.userId && (
              <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--w-80)" }}>
                Đây là bạn — không thể tự gửi tim
              </div>
            )}
          </div>

          {/* FORM GỬI TIM */}
          <form onSubmit={handleSubmit} className="card" style={{ display: "grid", gap: 12, padding: 16, width: "100%" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label className="label">Số tim muốn gửi</label>
              <input
                ref={amountRef}
                className="input"
                type="number"
                inputMode="numeric"
                pattern="\d*"
                min={1}
                max={meHearts ?? undefined}
                step={1}
                value={amount}
                onChange={onAmountChange}
                required
                disabled={disableForm}
                title={target.id === auth?.userId ? "Không thể gửi tim cho chính mình" : undefined}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label className="label">Lời nhắn (không bắt buộc)</label>
              <textarea
                className="input"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Viết gì đó dễ thương cho họ… (tuỳ chọn)"
                disabled={disableForm}
              />
            </div>

            {err && <div className="error">{err}</div>}
            {okMsg && <div className="toast">{okMsg}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => nav(-1)}>Quay lại</button>
              <button type="submit" className="btn btn-primary" disabled={submitting || disableForm}>
                {submitting ? "Đang gửi..." : "Xác nhận gửi tim"}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
