// src/pages/TeamHearts.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../lib/http";
import { getAuth } from "../lib/auth";
import { Users, ArrowLeftCircle } from "lucide-react";

type TeamDto = {
  id: number;
  name?: string;
  Name?: string;
  totalHearts?: number | null;
  TotalHearts?: number | null;
  heartCount?: number | null;
  HeartCount?: number | null;
};

function pickName(t: TeamDto) {
  return (t.name ?? t.Name ?? `Team #${t.id}`).toString();
}
function pickTotal(t: TeamDto): number {
  const val = t.totalHearts ?? t.TotalHearts ?? t.heartCount ?? t.HeartCount ?? 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export default function TeamHearts() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());

  // Chặn truy cập khi chưa đăng nhập
  useEffect(() => {
    if (!auth) nav("/login", { replace: true });
  }, [auth, nav]);
  if (!auth) return null;

  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await http.get(`/Teams?pageIndex=1&pageSize=1000`);
        const list: TeamDto[] = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
        if (!mounted) return;
        setTeams(list);
      } catch {
        if (!mounted) return;
        setErr("Không tải được danh sách đội. Vui lòng thử lại.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const sorted = useMemo(() => {
    return [...teams].sort((a, b) => pickTotal(b) - pickTotal(a));
  }, [teams]);

  const maxVal = useMemo(() => {
    const m = Math.max(0, ...sorted.map(pickTotal));
    return m || 1; // tránh chia 0
  }, [sorted]);

  const handleBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/", { replace: true });
  };

  return (
    <div className="give-wrap">
      <div className="container">
        <div className="page-slab" style={{ display: "grid", gap: 12 }}>

          {/* Nút Back trong suốt (chỉ icon), đặt bên ngoài – phía trên, góc trái */}
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <button
              onClick={handleBack}
              aria-label="Trở về"
              title="Trở về"
              style={{
                width: 72,
                height: 72,
                background: "transparent",
                border: "none",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#fff", // lucide dùng currentColor
                filter: "drop-shadow(0 6px 12px rgba(0,0,0,.35))",
              }}
            >
              <ArrowLeftCircle size={56} strokeWidth={2.5} />
            </button>
          </div>

          {/* Header / tiêu đề */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
              <div
                style={{
                  display: "grid", placeItems: "center",
                  width: 42, height: 42, borderRadius: 12,
                  background: "linear-gradient(180deg, var(--brand-600), var(--accent-600))",
                  border: "1px solid rgba(255,255,255,.22)",
                  boxShadow: "0 10px 22px rgba(216,180,254,.28)"
                }}
              >
                <Users size={18} />
              </div>
              <div style={{ fontWeight: 900, fontSize: 18, textAlign: "center" }}>
                Bảng so sánh tổng tim các đội
              </div>
            </div>
          </div>

          {err && <div className="error">{err}</div>}

          {/* Biểu đồ cột ngang (team xếp dọc) — KHÔNG avatar, chỉ tên + bar */}
          <div className="card" style={{ padding: 12 }}>
            {loading ? (
              <div className="muted">Đang tải…</div>
            ) : sorted.length === 0 ? (
              <div className="no-results">Chưa có dữ liệu đội.</div>
            ) : (
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
                          border: "1px solid rgba(255,255,255,.12)"
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, var(--brand-600), var(--accent-600))",
                            boxShadow: "0 6px 14px rgba(216,180,254,.35)"
                          }}
                          title={`${name}: ${total}`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
