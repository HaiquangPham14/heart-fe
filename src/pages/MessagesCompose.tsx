import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import http from "../lib/http";
import { API_BASE_URL, getAuth } from "../lib/auth";
import { ArrowLeftCircle, Send } from "lucide-react";

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

function toAbs(base: string, url?: string | null) {
  const s = (url ?? "").trim();
  if (!s) return AVATAR_FALLBACK;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
  return `${base}${s.startsWith("/") ? s : `/${s}`}`;
}
function apiOrigin(): string {
  try {
    const u = new URL(API_BASE_URL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return API_BASE_URL.replace(/\/api\/?$/, "");
  }
}
function pickName(u?: UserItem | null) {
  if (!u) return "";
  // @ts-ignore
  return (u.fullName ?? u.FullName ?? u.username ?? "").toString();
}

export default function MessagesCompose() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [auth] = useState(() => getAuth());
  useEffect(() => { if (!auth) nav("/login", { replace: true }); }, [auth, nav]);
  if (!auth) return null;

  const [receiver, setReceiver] = useState<UserItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/messages/new", { replace: true });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await http.get<UserItem>(`/Users/${id}`);
        if (!mounted) return;
        setReceiver(res.data);
      } catch {
        if (!mounted) return;
        setErr("Không tải được người nhận.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const onSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!receiver) return;
    const body = (content ?? "").trim();
    if (body.length === 0) return setErr("Vui lòng nhập nội dung.");
    if (body.length > 1000) return setErr("Nội dung quá dài (tối đa 1000 ký tự).");

    setSending(true);
    setErr(null);
    try {
      // ✨ BE mới: POST /Messages?uid=<senderId> với body { receiverId, content }
      await http.post(
        "/Messages",
        { receiverId: receiver.id, content: body },
        { params: { uid: auth!.userId } }
      );

      setSentOk(true);
      setContent("");
      setTimeout(() => handleBack(), 800);
    } catch {
      setErr("Gửi thất bại. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  };

  const name = pickName(receiver);
  const avatar = toAbs(apiOrigin(), receiver?.AvatarUrl ?? receiver?.avatarUrl ?? receiver?.avatar_url);

  return (
    <div className="give-wrap">
      <div className="container">
        <div className="page-slab" style={{ display: "grid", gap: 12 }}>

          {/* Back icon trắng trên bên trái */}
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

          {/* Người nhận */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={avatar}
                alt={name}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK; }}
                style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,.18)" }}
              />
              <div style={{ display: "grid" }}>
                <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>{name || "Người dùng"}</div>
                <div className="muted">@{receiver?.username}</div>
              </div>
            </div>
          </div>

          {/* Form gửi */}
          <form onSubmit={onSend} className="card" style={{ padding: 12 }}>
            <label className="label" htmlFor="msg">Nội dung lời nhắn</label>
            <textarea
              id="msg"
              className="input"
              style={{ minHeight: 140, resize: "vertical" }}
              placeholder="Nhập lời nhắn của bạn…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                {content.length}/1000
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending || !receiver || content.trim().length === 0}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Send size={16} />
                {sending ? "Đang gửi…" : "Gửi"}
              </button>
            </div>

            {err && <div className="error" style={{ marginTop: 8 }}>{err}</div>}
            {sentOk && <div className="success" style={{ marginTop: 8 }}>Đã gửi!</div>}
          </form>

        </div>
      </div>
    </div>
  );
}
