import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftCircle, Download, Loader2, FileSpreadsheet, Users, UsersRound } from "lucide-react";
import http from "../../lib/http";
import { getAuth } from "../../lib/auth";

function parseFilename(disposition?: string | null): string | null {
  if (!disposition) return null;
  // filename*=UTF-8''encoded or filename="plain"
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) try { return decodeURIComponent(utf8[1]); } catch {}
  const plain = /filename\s*=\s*"?([^"]+)"?/i.exec(disposition);
  return plain?.[1] || null;
}

export default function AdminExport() {
  const nav = useNavigate();
  const [auth] = useState(() => getAuth());

  useEffect(() => {
    if (!auth) { nav("/login", { replace: true }); return; }
    document.body.classList.add("no-footer");
    return () => document.body.classList.remove("no-footer");
  }, [auth, nav]);

  const [downloading, setDownloading] = useState<"teams" | "users" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/admin", { replace: true });
  };

  async function download(url: string, fallbackName: string) {
    setErr(null);
    try {
      const res = await http.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/octet-stream" });
      const name = parseFilename(res.headers["content-disposition"]) || fallbackName;
      const link = document.createElement("a");
      const href = URL.createObjectURL(blob);
      link.href = href;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch {
      setErr("Tải file thất bại. Vui lòng thử lại.");
    } finally {
      setDownloading(null);
    }
  }

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

          {/* Header */}
          <div className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Download size={18} />
                <div style={{ fontWeight: 800, fontSize: 18 }}>Xuất file</div>
              </div>
              <div className="muted">Excel Users / Teams</div>
            </div>
            {err && <div className="error">{err}</div>}
          </div>

          {/* Actions (mobile-first) */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <button
                className="btn btn-primary"
                disabled={!!downloading}
                onClick={() => { setDownloading("teams"); download("/Reports/export/teams", "teams.xlsx"); }}
                style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10 }}
              >
                <UsersRound size={18} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700 }}>Xuất Teams</div>
                  <div className="muted" style={{ fontSize: 12 }}>Tổng hợp tim đội (Hearts / Adjustments / Total)</div>
                </div>
                {downloading === "teams" ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />}
              </button>

              <button
                className="btn"
                disabled={!!downloading}
                onClick={() => { setDownloading("users"); download("/Reports/export/users", "users.xlsx"); }}
                style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10 }}
              >
                <Users size={18} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700 }}>Xuất Users</div>
                  <div className="muted" style={{ fontSize: 12 }}>Tim & tin nhắn theo cá nhân (Sent/Received)</div>
                </div>
                {downloading === "users" ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />}
              </button>
            </div>
          </div>

          {/* Gợi ý: mô tả cột để admin biết nội dung file */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Cột trong Teams.xlsx</div>
            <div className="muted" style={{ fontSize: 12 }}>
              TeamId, TeamName, Hearts, Adjustments, Total
            </div>
            <div style={{ fontWeight: 700, margin: "12px 0 6px" }}>Cột trong Users.xlsx</div>
            <div className="muted" style={{ fontSize: 12 }}>
              UserId, Username, FullName, HeartsReceived, Adjustments, TotalHearts, MessagesSent, MessagesReceived
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
