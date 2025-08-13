// src/pages/admin/AdminTeamsManage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeftCircle,
  Plus,
  Edit2,
  Trash2,
  UsersRound,
  Loader2,
  Save,
  X,
  Trophy,
  Download,
} from "lucide-react";
import http from "../../lib/http";
import { getAuth } from "../../lib/auth";

/* ============== Types ============== */
type TeamItem = {
  id: number;
  name: string;
  description?: string | null;
  heartCount?: number | null; // BE trả về
};

/* ============== Utils ============== */
function normalizeText(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
function pickName(t: TeamItem) {
  return (t.name || `Team #${t.id}`).toString();
}
function pickTotal(t: TeamItem): number {
  const n = Number(t.heartCount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/* ============== Page ============== */
export default function AdminTeamsManage() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());
  const isAdmin = (auth?.role || "").toLowerCase() === "admin";
  const mounted = useRef(true);

  // data
  const [raw, setRaw] = useState<TeamItem[]>([]);

  // ui state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(1); // 1-based
  const [pageSize, setPageSize] = useState(10);

  // drawer / bottom-sheet
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TeamItem | null>(null);
  const [fName, setFName] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [saving, setSaving] = useState(false);

  /* ---------- Loaders ---------- */
  async function loadTeams() {
    setLoading(true);
    setErr(null);
    try {
      // fetch "all" -> phân trang client-side
      const res = await http.get("/Teams", { params: { pageIndex: 1, pageSize: 1000 } });
      const list: TeamItem[] = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setRaw(list);
    } catch {
      setErr("Không tải được danh sách team.");
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
    loadTeams();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Derived: search + paging client-side ---------- */
  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) return raw;
    return raw.filter((t) => {
      const name = normalizeText(t.name || "");
      const desc = normalizeText(t.description || "");
      return name.includes(q) || desc.includes(q);
    });
  }, [raw, query]);

  // Leaderboard hiển thị đầu trang: sort theo heartCount giảm dần
  const leaderboardRows = useMemo(
    () => filtered.slice().sort((a, b) => (b.heartCount ?? 0) - (a.heartCount ?? 0)),
    [filtered]
  );

  const totalCount = filtered.length;
  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (pageIndex - 1) * pageSize;
  const pageItems = filtered.slice(offset, offset + pageSize);

  // khi đổi query/pageSize -> về trang 1
  useEffect(() => {
    setPageIndex(1);
  }, [query, pageSize]);

  /* ---------- Drawer helpers ---------- */
  function openAdd() {
    setEditing(null);
    setFName("");
    setFDesc("");
    setDrawerOpen(true);
  }
  function openEdit(t: TeamItem) {
    setEditing(t);
    setFName(t.name || "");
    setFDesc(t.description || "");
    setDrawerOpen(true);
  }
  function closeDrawer() {
    setDrawerOpen(false);
  }

  /* ---------- CRUD ---------- */
  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    const name = fName.trim();
    if (!name) return;

    setSaving(true);
    setErr(null);
    try {
      const payload: Partial<TeamItem> = { name, description: fDesc.trim() || null };
      if (!editing) {
        await http.post("/Teams", payload); // admin
      } else {
        await http.put(`/Teams/${editing.id}`, payload); // admin
      }
      closeDrawer();
      await loadTeams();
    } catch {
      setErr("Lưu thất bại. Vui lòng kiểm tra dữ liệu.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam(t: TeamItem) {
    if (!isAdmin) return;
    if (!confirm(`Xoá team "${t.name}"?`)) return;
    try {
      await http.delete(`/Teams/${t.id}`); // admin
      const remainInPage = pageItems.length - 1;
      const newPi = remainInPage > 0 ? pageIndex : Math.max(1, pageIndex - 1);
      setPageIndex(newPi);
      await loadTeams();
    } catch {
      alert("Xoá thất bại.");
    }
  }

  function exportExcel() {
    window.open("/api/Reports/export/teams", "_blank");
  }

  const from = pageItems.length ? offset + 1 : 0;
  const to = offset + pageItems.length;

  /* ============== Render ============== */
  return (
    <div className="give-wrap">
      {/* Sticky mobile top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backdropFilter: "saturate(1.4) blur(6px)",
          background: "rgba(18,18,20,.75)",
          borderBottom: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div className="container" style={{ padding: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => (window.history.length > 1 ? nav(-1) : nav("/admin", { replace: true }))}
              aria-label="Quay lại"
              className="btn btn-ghost"
              style={{ padding: 8 }}
            >
              <ArrowLeftCircle size={22} />
            </button>

            {/* search input */}
            <form
              onSubmit={(e) => {
                e.preventDefault(); /* filter client-side */
              }}
              style={{ position: "relative" }}
            >
              <input
                className="input"
                placeholder="Tìm tên/mô tả team…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingRight: 36 }}
                inputMode="search"
                aria-label="Tìm kiếm team"
              />
              {query && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setQuery("")}
                  aria-label="Xoá tìm kiếm"
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: 30,
                    width: 30,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </form>

            {/* actions */}
            <div style={{ display: "inline-flex", gap: 8 }}>
              <button className="btn btn-ghost" onClick={exportExcel} title="Export Excel" aria-label="Export Excel">
                <Download size={18} />
              </button>
              {isAdmin && (
                <button className="btn btn-primary" onClick={openAdd} aria-label="Thêm team">
                  <Plus size={18} />
                </button>
              )}
            </div>
          </div>

          {/* === Stat banner — mobile-first, full width === */}
          <div style={{ marginTop: 8 }} aria-live="polite">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 14,
                background: "linear-gradient(180deg, var(--brand-600), var(--accent-600))",
                border: "1px solid rgba(255,255,255,.22)",
                boxShadow: "0 10px 24px rgba(0,0,0,.25)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              <UsersRound size={18} />
              <span>
                Tổng: <b style={{ fontSize: 18 }}>{totalCount.toLocaleString()}</b> team
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: 10 }}>
        {/* Leaderboard - vertical (1 cột, mobile-first) */}
        <section className="card" style={{ padding: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Trophy size={18} /> <div style={{ fontWeight: 700 }}>Bảng xếp hạng team</div>
          </div>
          <TeamLeaderboardVertical rows={leaderboardRows} />
        </section>

        {/* List (hiển thị heartCount rõ ràng) */}
        <section className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="muted" style={{ display: "flex", gap: 8, alignItems: "center", padding: 12 }}>
              <Loader2 size={16} className="spin" /> Đang tải…
            </div>
          ) : err ? (
            <div className="error" style={{ padding: 12 }}>{err}</div>
          ) : !pageItems.length ? (
            <div className="muted" style={{ padding: 12 }}>Không có team.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {pageItems.map((t) => (
                <li key={t.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                  <div style={{ padding: 12, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 16,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.name}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          Tổng tim: <b>{(t.heartCount ?? 0).toLocaleString()}</b>
                        </div>
                      </div>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {isAdmin && (
                          <>
                            <button
                              className="btn btn-ghost"
                              onClick={() => openEdit(t)}
                              title="Sửa"
                              aria-label="Sửa"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={() => deleteTeam(t)}
                              title="Xoá"
                              aria-label="Xoá"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {!!t.description && (
                      <div className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>{t.description}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ===== Biểu đồ tổng tim (giống TeamHearts.tsx) ===== */}
        <section className="card" style={{ padding: 12, marginTop: 10 }}>
          {loading ? (
            <div className="muted">Đang tải…</div>
          ) : leaderboardRows.length === 0 ? (
            <div className="no-results">Chưa có dữ liệu đội.</div>
          ) : (
            <TeamHeartsChart rows={leaderboardRows} />
          )}
        </section>

        {/* Bottom pagination bar (sticky) */}
        <div
          style={{
            position: "sticky",
            bottom: 8,
            zIndex: 15,
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            padding: 8,
            borderRadius: 12,
            background: "rgba(18,18,20,.75)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,.08)",
            marginTop: 10,
          }}
        >
          <button className="btn" onClick={() => setPageIndex((p) => Math.max(1, p - 1))} disabled={pageIndex <= 1}>
            Trước
          </button>

          <div className="muted" style={{ fontSize: 12 }}>
            Trang <b>{pageIndex}</b> / <b>{maxPage}</b>
          </div>

          <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <select
              className="input"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 10)}
              aria-label="Số dòng mỗi trang"
              style={{ width: 92 }}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n} style={{ color: "#000" }}>
                  {n}/trang
                </option>
              ))}
            </select>
            <button
              className="btn"
              onClick={() => setPageIndex((p) => Math.min(maxPage, p + 1))}
              disabled={pageIndex >= maxPage}
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Sheet (mobile) */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDrawer();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,.55)",
            display: "grid",
            gridTemplateRows: "1fr auto",
          }}
        >
          <div />
          <div
            className="card"
            style={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderTop: "1px solid rgba(255,255,255,.2)",
              background: "rgba(20,22,28,.98)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingBottom: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{editing ? "Sửa team" : "Thêm team"}</div>
              <button className="btn btn-ghost" onClick={closeDrawer} aria-label="Đóng">
                <X size={16} /> Đóng
              </button>
            </div>

            <form onSubmit={submitForm} style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="label">Tên team</label>
                <input
                  className="input"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div>
                <label className="label">Mô tả</label>
                <textarea
                  className="input"
                  rows={3}
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              {err && <div className="error">{err}</div>}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={closeDrawer}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !fName.trim()}>
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

/* ============== Leaderboard Vertical (1 cột) ============== */
function TeamLeaderboardVertical({ rows }: { rows: TeamItem[] }) {
  if (!rows.length) return <div className="muted">Chưa có dữ liệu.</div>;

  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gap: 8,
      }}
    >
      {rows.map((r, idx) => (
        <li key={r.id} className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(255,255,255,.2)",
              fontWeight: 800,
            }}
            aria-label={`Hạng ${idx + 1}`}
            title={`Hạng ${idx + 1}`}
          >
            {idx + 1}
          </div>
          <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 700,
                minWidth: 0,
              }}
            >
              {idx === 0 && <Trophy size={14} />}{" "}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pickName(r)}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Tổng tim: <b>{pickTotal(r).toLocaleString()}</b>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ============== Biểu đồ tim (giống TeamHearts.tsx) ============== */
function TeamHeartsChart({ rows }: { rows: TeamItem[] }) {
  const sorted = useMemo(() => {
    return rows.slice().sort((a, b) => pickTotal(b) - pickTotal(a));
  }, [rows]);

  const maxVal = useMemo(() => {
    const m = Math.max(0, ...sorted.map(pickTotal));
    return m || 1; // tránh chia 0
  }, [sorted]);

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
      {sorted.map((t, idx) => {
        const name = pickName(t);
        const total = pickTotal(t);
        const pct = Math.max(2, Math.round((total / maxVal) * 100)); // min 2% cho dễ nhìn
        return (
          <li key={t.id} className="card" style={{ padding: 10 }}>
            {/* Hàng team: tên + số */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {idx + 1}. {name}
              </div>
              <div style={{ fontWeight: 900 }}>{total}</div>
            </div>

            {/* Bar ngang */}
            <div
              aria-hidden
              style={{
                marginTop: 8,
                width: "100%",
                height: 16,
                borderRadius: 999,
                background: "rgba(255,255,255,.10)",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,.12)",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--brand-600), var(--accent-600))",
                  boxShadow: "0 6px 14px rgba(216,180,254,.35)",
                }}
                title={`${name}: ${total}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
