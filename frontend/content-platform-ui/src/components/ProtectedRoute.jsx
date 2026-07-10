/*
Protected route
*/

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";

function ProtectedRoute({ children }) {
    const { token, loading, authError } = useAuth();

    if (loading) return <div className="muted-box">Loading...</div>;

    if (!token) {
        return <Navigate to="/login" state={authError ? { error: authError } : null} replace />;
    }

    return children;
}

export default ProtectedRoute;
