/*
Register page
*/

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register as registerApi } from "../api/auth";
import { getApiErrorMessage } from "../api/response";
import { useAuth } from "../context/auth-context";

function RegisterPage() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const auth = useAuth();

    useEffect(() => {
        if (auth.token) {
            navigate("/");
        }
    }, [auth.token, navigate]);

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            await registerApi({ username, email, password });
            navigate("/login", {
                replace: true,
                state: { success: "Registration successful. Please log in." }
            });
        } catch (err) {
            const message = getApiErrorMessage(err);
            setError(message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="card form-card">
            <div className="card__body">
                <h1 className="form-title">Register</h1>
                <p className="form-text">
                    Create a new account to publish content and interact with other users.
                </p>

                <form className="form-grid" onSubmit={handleSubmit}>
                    <label className="field">
                        <span className="field__label">Username</span>
                        <input
                            className="field__input"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={submitting}
                        />
                    </label>

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
                            placeholder="Create password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={submitting}
                        />
                    </label>

                    {error && <div className="muted-box">{error}</div>}

                    <div className="form-actions">
                        <button className="btn btn--primary" type="submit" disabled={submitting}>
                            {submitting ? "Creating..." : "Register"}
                        </button>

                        <Link className="btn btn--secondary" to="/login">
                            Log in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default RegisterPage;
