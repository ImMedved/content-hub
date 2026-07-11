import { useState } from "react";
import ToastViewport from "../components/ToastViewport";
import { ToastContext } from "./toast-context";

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    function removeToast(id) {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }

    function showToast(message, tone = "info") {
        if (!String(message || "").trim()) {
            return;
        }

        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setToasts((current) => [...current, { id, message, tone }]);

        setTimeout(() => {
            removeToast(id);
        }, 2200);
    }

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <ToastViewport toasts={toasts} onDismiss={removeToast} />
        </ToastContext.Provider>
    );
}
