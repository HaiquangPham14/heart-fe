import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Heart, UserSearch, Users, Send, Bell, Eye, EyeOff, LogOut, ShieldCheck } from "lucide-react";
import { login, getAuth, clearAuth, type AuthUser } from "../lib/auth";

const AVATAR_FALLBACK =
  "https://cdn.jsdelivr.net/gh/HaiquangPham14/Droppi_ToDoListApp@main/image-Photoroom.png";

function isAdmin(u: AuthUser | null) {
  const r = (u?.role ?? u?.role ?? "").toString().toLowerCase();
  return r.includes("admin");
}

export default function LoginPage() {
  const nav = useNavigate();

  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Nếu đã có session và là admin -> chuyển thẳng vào /admin
  useEffect(() => {
    const a = getAuth();
    if (a) {
      setAuth(a);
      if (isAdmin(a)) nav("/admin", { replace: true });
    }
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const a = await login(username.trim(), password);
      setAuth(a);
      // Admin -> vào dashboard admin
      if (isAdmin(a)) {
        nav("/admin", { replace: true });
      }
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const msg =
          (error.response?.data as any)?.message ??
          error.response?.data ??
          "Đăng nhập thất bại. Vui lòng kiểm tra lại.";
        setErr(typeof msg === "string" ? msg : "Đăng nhập thất bại. Vui lòng kiểm tra lại.");
      } else {
        setErr("Có lỗi xảy ra. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
    setUsername("");
    setPassword("");
  }

  // ========= AUTHENTICATED VIEW =========
  if (auth) {
    const avatarUrl = auth.avatarUrl || AVATAR_FALLBACK;

    return (
      <div style={{ minHeight: "100dvh" }}>
        <header className="header">
          <div className="container header-inner">
            <div className="brand">
              <div className="brand-logo">
                <Heart size={18} color="#fff" />
              </div>
              <div>Heart Event</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={avatarUrl}
                alt={auth.username}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = AVATAR_FALLBACK;
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "1px solid rgba(255,255,255,.28)",
                  boxShadow: "0 4px 12px rgba(0,0,0,.25)",
                }}
              />
              <span className="muted">
                Xin chào, <b>{auth.username}</b> ({auth.role})
              </span>
              <button className="btn btn-ghost" onClick={handleLogout} aria-label="Đăng xuất">
                <LogOut size={16} /> <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="hero" aria-label="Logo">
          <div className="hero-inner">
            <img
              className="hero-logo"
              src="https://cdn.jsdelivr.net/gh/HaiquangPham14/Droppi_ToDoListApp@main/image-Photoroom.png"
              alt="Heart Event"
              loading="eager"
              decoding="async"
            />
          </div>
        </section>

        {/* DOCK */}
        <nav className="feature-dock" aria-label="Lối tắt chức năng">
          <div className="feature-dock-inner">
            <div className="dock-panel">
              <div className="dock-stack">
                <a className="feature-btn" href="/hearts/new">
                  <div className="icon">
                    <Heart size={18} />
                  </div>
                  <div className="text">
                    <div className="title">Thả tim</div>
                    <div className="desc">Tặng tim cho cá nhân/đội</div>
                  </div>
                </a>

                <a className="feature-btn" href="/hearts/personal">
                  <div className="icon">
                    <UserSearch size={18} />
                  </div>
                  <div className="text">
                    <div className="title">Tim cá nhân</div>
                    <div className="desc">Tổng tim bạn đã nhận</div>
                  </div>
                </a>

                <a className="feature-btn" href="/hearts/team">
                  <div className="icon">
                    <Users size={18} />
                  </div>
                  <div className="text">
                    <div className="title">Tim đội</div>
                    <div className="desc">Danh sách & thống kê</div>
                  </div>
                </a>

                <a className="feature-btn" href="/messages/new">
                  <div className="icon">
                    <Send size={18} />
                  </div>
                  <div className="text">
                    <div className="title">Gửi lời nhắn</div>
                    <div className="desc">Nhắn tin cho cá nhân</div>
                  </div>
                </a>

                <a className="feature-btn" href="/notifications">
                  <div className="icon">
                    <Bell size={18} />
                  </div>
                  <div className="text">
                    <div className="title">Thông báo</div>
                    <div className="desc">Tin mới từ BTC</div>
                  </div>
                </a>

                {/* Nút vào trang quản trị nếu là admin */}
                {isAdmin(auth) && (
                  <a className="feature-btn" href="/admin">
                    <div className="icon">
                      <ShieldCheck size={18} />
                    </div>
                    <div className="text">
                      <div className="title">Quản trị</div>
                      <div className="desc">Bảng điều khiển Admin</div>
                    </div>
                  </a>
                )}
              </div>
            </div>
          </div>
        </nav>
      </div>
    );
  }

  // ========= LOGIN VIEW =========
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-head">
          <div className="brand-logo">
            <Heart size={18} color="#fff" />
          </div>
          <div>
            <h1>Đăng nhập</h1>
            <div className="login-muted">Vào hệ thống Heart Event</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label htmlFor="username" className="label">
              Tài khoản
            </label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tài khoản"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              Mật khẩu
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                className="input"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="input-action"
                aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onClick={() => setShowPw((v) => !v)}
                title={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {err && <div className="error">{String(err)}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading && <span className="spinner" />}
            <span>Đăng nhập</span>
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="muted">Chưa có tài khoản?</span>{" "}
          <Link to="/register" className="btn btn-ghost" style={{ padding: "8px 12px" }}>
            Đăng ký
          </Link>
        </div>

        <div className="footer">© {new Date().getFullYear()} Heart Event. All rights reserved.</div>
      </div>
    </div>
  );
}
