function ToastViewport({ toasts, onDismiss }) {
    return (
        <div className="toast-viewport" aria-live="polite" aria-atomic="true">
            {toasts.map((toast) => (
                <button
                    key={toast.id}
                    className={`toast toast--${toast.tone || "info"}`}
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                >
                    {toast.message}
                </button>
            ))}
        </div>
    );
}

export default ToastViewport;
