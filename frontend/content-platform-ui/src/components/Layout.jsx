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
import { resolveMediaUrl } from "../utils/media";

const HEADER_TRANSITION_MS = 220;

function Layout({ children }) {
    const { user, logout } = useAuth();
    const { activeTheme, audioQuality, setAudioQuality, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const lastScrollY = useRef(0);
    const animationLock = useRef(false);
    const animationTimeout = useRef(null);
    const settingsRef = useRef(null);
    const [collapsed, setCollapsed] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

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

    useEffect(() => {
        function handleDocumentClick(event) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setSettingsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleDocumentClick);

        return () => {
            document.removeEventListener("mousedown", handleDocumentClick);
        };
    }, []);

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
                            Music
                        </NavLink>

                        <NavLink
                            to="/messages"
                            className={({ isActive }) =>
                                `navbar__link ${isActive ? "navbar__link--active" : ""}`
                            }
                        >
                            Messages
                        </NavLink>
                    </nav>

                    <div className="header-user">
                        {user?.id && (
                            <Link className="header-user__profile" to={`/users/${user.id}`}>
                                <span className="header-user__name">
                                    {user?.display_name || user?.username || "User"}
                                </span>
                                <img
                                    className="avatar avatar--header"
                                    src={resolveMediaUrl(user?.avatar_url)}
                                    alt=""
                                />
                            </Link>
                        )}

                        <div className="settings-menu" ref={settingsRef}>
                            <button
                                className="settings-menu__trigger"
                                type="button"
                                onClick={() => setSettingsOpen((current) => !current)}
                                aria-label="Settings"
                                aria-expanded={settingsOpen}
                            >
                                &#9881;
                            </button>

                            {settingsOpen && (
                                <div className="settings-menu__panel">
                                    <button className="settings-menu__item" onClick={toggleTheme} type="button">
                                        Theme: {activeTheme === "dark" ? "Dark" : "Light"}
                                    </button>
                                    <div className="settings-menu__wallet">
                                        <span>Wallet</span>
                                        <strong>{typeof user?.wallet_balance === "number" ? user.wallet_balance : 0}</strong>
                                    </div>
                                    <label className="settings-menu__field">
                                        <span>Music quality</span>
                                        <select
                                            value={audioQuality}
                                            onChange={(event) => setAudioQuality(event.target.value)}
                                        >
                                            <option value="auto">Auto</option>
                                            <option value="96000">96 kbps</option>
                                            <option value="128000">128 kbps</option>
                                            <option value="192000">192 kbps</option>
                                            <option value="320000">320 kbps</option>
                                        </select>
                                    </label>
                                    <button className="settings-menu__item settings-menu__item--danger" onClick={handleLogout} type="button">
                                        Log out
                                    </button>
                                </div>
                            )}
                        </div>
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
