import { useState } from "react";
import axios from "axios";
import { Heart, Eye, EyeOff } from "lucide-react";
import { API_BASE_URL, login } from "../lib/auth";
import { useNavigate, Link } from "react-router-dom";

type FieldErrors = Partial<Record<"fullName"|"username"|"email"|"password"|"confirm", string>>;

const usernameRe = /^[a-zA-Z0-9_]{3,20}$/;           // 3-20 ký tự chữ/số/_ 
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;        // check cơ bản
const MIN_PW = 8;

export default function RegisterPage() {
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");

  const [showPw, setShowPw]   = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const e: FieldErrors = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      e.fullName = "Họ tên tối thiểu 2 ký tự.";
    }
    if (!usernameRe.test(username.trim())) {
      e.username = "Username 3-20 ký tự, chỉ chữ/số/_ .";
    }
    if (email.trim() && !emailRe.test(email.trim())) {
      e.email = "Email không hợp lệ.";
    }
    if (password.length < MIN_PW) {
      e.password = `Mật khẩu tối thiểu ${MIN_PW} ký tự.`;
    }
    if (confirm !== password) {
      e.confirm = "Mật khẩu nhập lại không khớp.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setServerErr(null);
    setLoading(true);
    try {
      // Đăng ký — lưu ý: API_BASE_URL đã bao gồm /api ở cuối (VD: http://localhost:44374/api)
      await axios.post(`${API_BASE_URL}/auth/register`, {
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        email: email.trim() || undefined,
      });

      // Tự đăng nhập để lấy token & lưu localStorage
      await login(username.trim(), password);

      // Vào trang chính (LoginPage sẽ nhận ra auth và hiển thị view đã đăng nhập)
      nav("/", { replace: true });
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as any)?.message || err.response?.data || "Đăng ký thất bại.";
        setServerErr(typeof msg === "string" ? msg : "Đăng ký thất bại.");
      } else {
        setServerErr("Có lỗi xảy ra. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-head">
          <div className="brand-logo">
            <Heart size={18} color="#fff" />
          </div>
          <div>
            <h1>Đăng ký</h1>
            <div className="login-muted">Tạo tài khoản Heart Event</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label className="label" htmlFor="fullName">Họ tên</label>
            <input
              id="fullName"
              className="input"
              value={fullName}
              onChange={(e)=>setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? "err-fullName" : undefined}
            />
            {errors.fullName && <div id="err-fullName" className="error" style={{marginTop:8}}>{errors.fullName}</div>}
          </div>

          <div>
            <label className="label" htmlFor="username">Tài khoản</label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e)=>setUsername(e.target.value)}
              placeholder="username"
              autoComplete="username"
              required
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? "err-username" : undefined}
            />
            {errors.username && <div id="err-username" className="error" style={{marginTop:8}}>{errors.username}</div>}
          </div>

          <div>
            <label className="label" htmlFor="email">Email (tuỳ chọn)</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "err-email" : undefined}
            />
            {errors.email && <div id="err-email" className="error" style={{marginTop:8}}>{errors.email}</div>}
          </div>

          <div>
            <label className="label" htmlFor="password">Mật khẩu</label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                className="input"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                style={{ paddingRight: 44 }}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "err-password" : undefined}
              />
              <button type="button" className="input-action" onClick={()=>setShowPw(v=>!v)}
                aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                {showPw ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
            {errors.password && <div id="err-password" className="error" style={{marginTop:8}}>{errors.password}</div>}
          </div>

          <div>
            <label className="label" htmlFor="confirm">Nhập lại mật khẩu</label>
            <div style={{ position: "relative" }}>
              <input
                id="confirm"
                className="input"
                type={showPw2 ? "text" : "password"}
                value={confirm}
                onChange={(e)=>setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                style={{ paddingRight: 44 }}
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? "err-confirm" : undefined}
              />
              <button type="button" className="input-action" onClick={()=>setShowPw2(v=>!v)}
                aria-label={showPw2 ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                {showPw2 ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
            {errors.confirm && <div id="err-confirm" className="error" style={{marginTop:8}}>{errors.confirm}</div>}
          </div>

          {serverErr && <div className="error">{serverErr}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading && <span className="spinner" />} Tạo tài khoản
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="muted">Đã có tài khoản?</span>{" "}
          <Link to="/" className="btn btn-ghost" style={{ padding: "8px 12px" }}>Đăng nhập</Link>
        </div>

        <div className="footer">© {new Date().getFullYear()} Heart Event</div>
      </div>
    </div>
  );
}
