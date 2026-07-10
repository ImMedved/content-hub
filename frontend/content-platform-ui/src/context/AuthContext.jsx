/*
Auth context
- token
- user
- auto load user
*/

import { useEffect, useState } from "react";
import { getMyProfile } from "../api/user";
import { getApiErrorMessage } from "../api/response";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState("");

    async function loadUser() {
        try {
            const profileData = await getMyProfile();
            setUser(profileData?.user || null);
            setAuthError("");
        } catch (err) {
            const message = getApiErrorMessage(err);
            setAuthError(message);
            logout();
        } finally {
            setLoading(false);
        }
    }

    function login(nextToken) {
        if (!nextToken || typeof nextToken !== "string") {
            throw new Error("Login response does not include a valid token");
        }

        localStorage.setItem("token", nextToken);
        setToken(nextToken);
        setLoading(true);
        setAuthError("");
    }

    function logout() {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
        setLoading(false);
    }

    async function refreshUser() {
        if (!token) {
            return;
        }

        await loadUser();
    }

    useEffect(() => {
        let active = true;

        async function syncAuth() {
            if (!token) {
                if (!active) {
                    return;
                }

                setUser(null);
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                const profileData = await getMyProfile();

                if (!active) {
                    return;
                }

                setUser(profileData?.user || null);
                setAuthError("");
            } catch (err) {
                if (!active) {
                    return;
                }

                const message = getApiErrorMessage(err);
                localStorage.removeItem("token");
                setToken(null);
                setUser(null);
                setAuthError(message);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        syncAuth();

        return () => {
            active = false;
        };
    }, [token]);

    return (
        <AuthContext.Provider value={{
            token,
            user,
            login,
            logout,
            refreshUser,
            loading,
            authError
        }}>
            {children}
        </AuthContext.Provider>
    );
}
