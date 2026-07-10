import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getChats, waitForMessageUpdates } from "../api/message";
import { getApiErrorMessage } from "../api/response";
import { resolveMediaUrl } from "../utils/media";

function MessagesPage() {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const lastMessageIdRef = useRef(0);

    useEffect(() => {
        loadChats();
    }, []);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        async function listen() {
            while (!cancelled) {
                try {
                    const updates = await waitForMessageUpdates(lastMessageIdRef.current, controller.signal);

                    if (cancelled) {
                        return;
                    }

                    if (updates.length > 0) {
                        const newestId = updates[updates.length - 1].id;
                        lastMessageIdRef.current = Math.max(lastMessageIdRef.current, newestId);
                        await loadChats(true);
                    }
                } catch (err) {
                    if (controller.signal.aborted || cancelled) {
                        return;
                    }

                    setError(getApiErrorMessage(err));
                    await new Promise((resolve) => setTimeout(resolve, 1200));
                }
            }
        }

        listen();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

    async function loadChats(isBackgroundRefresh = false) {
        if (!isBackgroundRefresh) {
            setLoading(true);
        }

        setError("");

        try {
            const response = await getChats();
            const nextChats = Array.isArray(response) ? response : [];

            setChats(nextChats);
            lastMessageIdRef.current = nextChats.reduce((maxId, item) => {
                const candidate = Number(item?.last_message?.id || 0);
                return candidate > maxId ? candidate : maxId;
            }, lastMessageIdRef.current);
        } catch (err) {
            setError(getApiErrorMessage(err));
            if (!isBackgroundRefresh) {
                setChats([]);
            }
        } finally {
            if (!isBackgroundRefresh) {
                setLoading(false);
            }
        }
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">Messages</h1>
                    <p className="page-subtitle">Open an existing chat or start a new one from your following list.</p>
                </div>

                <div className="page-actions">
                    <Link className="btn btn--secondary" to="/messages/new">
                        Start new chat
                    </Link>
                    <button className="btn btn--primary" onClick={() => loadChats()} type="button">
                        Refresh
                    </button>
                </div>
            </div>

            {loading && <div className="muted-box">Loading chats...</div>}
            {error && <div className="muted-box">{error}</div>}

            {!loading && (
                <div className="chat-list">
                    {chats.length > 0 && chats.map((chat) => (
                        <Link key={chat.peer.id} className="chat-list-item card" to={`/messages/${chat.peer.id}`}>
                            <div className="card__body chat-list-item__body">
                                <img className="avatar avatar--md" src={resolveMediaUrl(chat.peer.avatar_url)} alt="" />
                                <div className="chat-list-item__content">
                                    <div className="chat-list-item__top">
                                        <div>
                                            <div className="user-card__name">
                                                {chat.peer.display_name || chat.peer.username}
                                            </div>
                                            <div className="user-card__meta">@{chat.peer.username}</div>
                                        </div>
                                        {chat.unread_count > 0 && (
                                            <span className="chat-badge">{chat.unread_count}</span>
                                        )}
                                    </div>
                                    <p className="chat-list-item__message">
                                        {chat.last_message.body}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}

                    {chats.length === 0 && (
                        <div className="muted-box">
                            No chats yet. Start with someone you already follow.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default MessagesPage;
