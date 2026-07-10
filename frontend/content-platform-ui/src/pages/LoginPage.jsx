/*
Login page
*/

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { login as loginApi } from "../api/auth";
import { getApiErrorMessage } from "../api/response";
import { useAuth } from "../context/auth-context";

function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const auth = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const routeSuccess = location.state?.success || "";
    const routeError = location.state?.error || "";

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const res = await loginApi({ email, password });
            const token = res.token;
            auth.login(token);
            navigate("/");
        } catch (err) {
            const message = getApiErrorMessage(err);
            setError(message);
        } finally {
            setSubmitting(false);
        }
    }

    useEffect(() => {
        if (auth.token) {
            navigate("/");
        }
    }, [auth.token, navigate]);

    return (
        <div className="card form-card">
            <div className="card__body">
                <h1 className="form-title">Login</h1>
                <p className="form-text">
                    Sign in to open your feed, create posts, and manage your profile.
                </p>

                <form className="form-grid" onSubmit={handleSubmit}>
                    <label className="field">
                        <span className="field__label">Email</span>
                        <input
                            className="field__input"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={submitting}
                        />
                    </label>

                    <label className="field">
                        <span className="field__label">Password</span>
                        <input
                            className="field__input"
                            placeholder="Enter password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={submitting}
                        />
                    </label>

                    {(error || routeError) && <div className="muted-box">{error || routeError}</div>}
                    {routeSuccess && !error && !routeError && (
                        <div className="muted-box">{routeSuccess}</div>
                    )}
                    {auth.authError && !error && !routeError && !routeSuccess && (
                        <div className="muted-box">{auth.authError}</div>
                    )}

                    <div className="form-actions">
                        <button className="btn btn--primary" type="submit" disabled={submitting}>
                            {submitting ? "Signing in..." : "Log in"}
                        </button>

                        <Link className="btn btn--secondary" to="/register">
                            Register
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default LoginPage;
