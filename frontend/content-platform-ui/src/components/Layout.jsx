/*
Layout
- navbar
- navigation
- logout
- header
- footer
- page container
*/

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";

const HEADER_TRANSITION_MS = 220;

function Layout({ children }) {
    const { user, logout } = useAuth();
    const { activeTheme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const lastScrollY = useRef(0);
    const animationLock = useRef(false);
    const animationTimeout = useRef(null);
    const [collapsed, setCollapsed] = useState(false);

    function handleLogout() {
        logout();
        navigate("/login");
    }

    useEffect(() => {
        const lockHeader = () => {
            animationLock.current = true;

            if (animationTimeout.current) {
                clearTimeout(animationTimeout.current);
            }

            animationTimeout.current = setTimeout(() => {
                animationLock.current = false;
            }, HEADER_TRANSITION_MS);
        };

        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if (!animationLock.current) {
                if (currentScrollY <= 0 && collapsed) {
                    setCollapsed(false);
                    lockHeader();
                } else if (currentScrollY > lastScrollY.current && !collapsed) {
                    setCollapsed(true);
                    lockHeader();
                } else if (currentScrollY < lastScrollY.current && collapsed) {
                    setCollapsed(false);
                    lockHeader();
                }
            }

            lastScrollY.current = currentScrollY;
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);

            if (animationTimeout.current) {
                clearTimeout(animationTimeout.current);
            }
        };
    }, [collapsed]);

    return (
        <div className="app-shell">
            <header className={`site-header ${collapsed ? "site-header--collapsed" : ""}`}>
                <div className="site-header__inner">
                    <Link className="brand" to="/">
                        <div className="brand__logo">С</div>
                        <div className="brand__name">Content Hub</div>
                    </Link>

                    <nav className="navbar">
                        <NavLink
                            to="/"
                            className={({ isActive }) =>
                                `navbar__link ${isActive ? "navbar__link--active" : ""}`
                            }
                        >
                            Feed
                        </NavLink>

                        <NavLink
                            to="/following"
                            className={({ isActive }) =>
                                `navbar__link ${isActive ? "navbar__link--active" : ""}`
                            }
                        >
                            Following
                        </NavLink>

                        <NavLink
                            to="/messages"
                            className={({ isActive }) =>
                                `navbar__link ${isActive ? "navbar__link--active" : ""}`
                            }
                        >
                            Messages
                        </NavLink>

                        <NavLink
                            to="/images"
                            className={({ isActive }) =>
                                `navbar__link ${isActive ? "navbar__link--active" : ""}`
                            }
                        >
                            Grid
                        </NavLink>

                        <NavLink
                            to="/videos"
                            className={({ isActive }) =>
                                `navbar__link ${isActive ? "navbar__link--active" : ""}`
                            }
                        >
                            Videos
                        </NavLink>

                        <NavLink
                            to="/audio"
                            className={({ isActive }) =>
                                `navbar__link ${isActive ? "navbar__link--active" : ""}`
                            }
                        >
                            Audio
                        </NavLink>

                        <NavLink
                            to="/tracks"
                            className={({ isActive }) =>
                                `navbar__link ${isActive ? "navbar__link--active" : ""}`
                            }
                        >
                            Tracks
                        </NavLink>

                        {user?.id && (
                            <NavLink
                                to={`/users/${user.id}`}
                                className={({ isActive }) =>
                                    `navbar__link ${isActive ? "navbar__link--active" : ""}`
                                }
                            >
                                Profile
                            </NavLink>
                        )}
                    </nav>

                    <div className="header-user">
                        <span className="header-user__name">
                            {user?.display_name || user?.username || "User"}
                        </span>
                        {typeof user?.wallet_balance === "number" && (
                            <span className="header-user__wallet">
                                Wallet: {user.wallet_balance}
                            </span>
                        )}
                        <button className="btn btn--secondary theme-toggle" onClick={toggleTheme} type="button">
                            {activeTheme === "dark" ? "Dark" : "Light"}
                        </button>
                        <button className="btn btn--secondary" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="site-main">
                <div className="page-container">{children}</div>
            </main>

            <footer className="site-footer">
                <div className="site-footer__inner">
                    "Systems III - Information systems" seminar implementation build
                </div>
            </footer>
        </div>
    );
}

export default Layout;
