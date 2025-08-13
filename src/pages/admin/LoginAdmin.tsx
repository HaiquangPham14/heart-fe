import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Heart,
    Users,
    UsersRound,
    Scale3D,
    MessageSquare,
    Bell,
    Download,
    LogOut,
} from "lucide-react";
import { getAuth, clearAuth, type AuthUser } from "../../lib/auth";

const AVATAR_FALLBACK =
    "https://cdn.jsdelivr.net/gh/HaiquangPham14/Droppi_ToDoListApp@main/image-Photoroom.png";

function isAdmin(u: AuthUser | null) {
    const r = (u?.role ?? u?.role ?? "").toString().toLowerCase();
    return r.includes("admin");
}

export default function LoginAdmin() {
    const nav = useNavigate();
    const [auth, setAuth] = useState<AuthUser | null>(null);

    useEffect(() => {
        const a = getAuth();
        if (!a) {
            nav("/login", { replace: true });
            return;
        }
        if (!isAdmin(a)) {
            // Không phải admin thì về trang chủ
            nav("/", { replace: true });
            return;
        }
        setAuth(a);
    }, [nav]);

    function handleLogout() {
        clearAuth();
        setAuth(null);
        nav("/login", { replace: true });
    }

    if (!auth) return null;

    const avatarUrl = auth.avatarUrl || AVATAR_FALLBACK;

    return (
        <div style={{ minHeight: "100dvh" }}>
            {/* HEADER giống Login đã đăng nhập */}
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
                            Xin chào, <b>{auth.username}</b>
                        </span>
                        <button className="btn btn-ghost" onClick={handleLogout} aria-label="Đăng xuất">
                            <LogOut size={16} /> <span>Đăng xuất</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* HERO nhẹ cho đồng bộ visual với Login */}
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

            {/* 6 tính năng quản trị — layout giống “feature-dock” để đồng nhất */}
            <nav className="feature-dock" aria-label="Bảng điều khiển Admin">
                <div className="feature-dock-inner">
                    <div className="dock-panel">
                        {/* BỎ className="dock-stack" để tránh CSS cũ override */}
                        <div
                            style={{
                                display: "grid",
                                gap: 12,
                                gridTemplateColumns: "1fr",   // <-- 1 cột = 6 hàng
                                width: "100%",
                            }}
                        >
                            <Link className="feature-btn" to="/admin/users" style={{ width: "100%" }}>
                                <div className="icon"><Users size={18} /></div>
                                <div className="text">
                                    <div className="title">Quản lý User</div>
                                    <div className="desc">Danh sách, tim & tin nhắn</div>
                                </div>
                            </Link>

                            <Link className="feature-btn" to="/admin/teams" style={{ width: "100%" }}>
                                <div className="icon"><UsersRound size={18} /></div>
                                <div className="text">
                                    <div className="title">Quản lý Team</div>
                                    <div className="desc">Tổng hợp & xếp hạng tim</div>
                                </div>
                            </Link>

                            <Link className="feature-btn" to="/admin/adjustments" style={{ width: "100%" }}>
                                <div className="icon"><Scale3D size={18} /></div>
                                <div className="text">
                                    <div className="title">Quản lý Thưởng/Phạt</div>
                                    <div className="desc">Chấm điểm & điều chỉnh tim</div>
                                </div>
                            </Link>

                            <Link className="feature-btn" to="/admin/messages" style={{ width: "100%" }}>
                                <div className="icon"><MessageSquare size={18} /></div>
                                <div className="text">
                                    <div className="title">Quản lý Tin nhắn</div>
                                    <div className="desc">Xem & gửi tin theo cá nhân</div>
                                </div>
                            </Link>

                            <Link className="feature-btn" to="/admin/notifications" style={{ width: "100%" }}>
                                <div className="icon"><Bell size={18} /></div>
                                <div className="text">
                                    <div className="title">Quản lý Thông báo</div>
                                    <div className="desc">Soạn & đặt lịch gửi</div>
                                </div>
                            </Link>

                            <Link className="feature-btn" to="/admin/export" style={{ width: "100%" }}>
                                <div className="icon"><Download size={18} /></div>
                                <div className="text">
                                    <div className="title">Xuất file</div>
                                    <div className="desc">Excel Users / Teams</div>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>
        </div>
    );
}
