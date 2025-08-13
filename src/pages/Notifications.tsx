// src/pages/Notifications.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../lib/http";
import { ArrowLeftCircle, Bell } from "lucide-react";

type NotificationItem = {
  id: number;
  title?: string | null; Title?: string | null;
  content?: string | null; Content?: string | null;
  createdAt?: string | null; CreatedAt?: string | null;
};

const POLL_MS = 10000;

export default function Notifications() {
  const nav = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const inited = useRef(false);
  const timerRef = useRef<number | null>(null);

  const handleBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/", { replace: true });
  };

  const loadData = async () => {
    try {
      const res = await http.get("/Notifications/available", {
        params: { pageIndex: 1, pageSize: 50 },
      });
      const data = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setItems(data);
      setErr(null);
    } catch {
      setErr("Không tải được thông báo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    loadData();
    timerRef.current = window.setInterval(loadData, POLL_MS);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="give-wrap">
      <div className="container">
        <div className="page-slab" style={{ display: "grid", gap: 12 }}>
          {/* Back icon trắng, trong suốt, phía trên bên trái */}
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

          {/* Tiêu đề */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={18} />
              <div style={{ fontWeight: 800, fontSize: 18 }}>Thông báo từ BTC</div>
            </div>
            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            </div>
          </div>

          {/* Danh sách thông báo */}
          <div className="card" style={{ padding: 12 }}>
            {loading ? (
              <div className="muted">Đang tải…</div>
            ) : err ? (
              <div className="error">{err}</div>
            ) : items.length === 0 ? (
              <div className="muted">Chưa có thông báo nào.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {items.map((n) => {
                  const title = (n.title ?? n.Title ?? "").toString() || "(Không có tiêu đề)";
                  const content = (n.content ?? n.Content ?? "").toString();
                  const time =
                    (n.createdAt ?? n.CreatedAt ?? "") &&
                    new Date(n.createdAt ?? (n as any).CreatedAt).toLocaleString();

                  return (
                    <li key={n.id} className="card" style={{ padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800 }}>{title}</div>
                        {time && <div className="muted" style={{ fontSize: 12 }}>{time}</div>}
                      </div>
                      {content && <div style={{ marginTop: 6, lineHeight: 1.6 }}>{content}</div>}
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
