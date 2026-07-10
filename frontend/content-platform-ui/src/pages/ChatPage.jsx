import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getConversation, sendMessage, waitForMessageUpdates } from "../api/message";
import { getApiErrorMessage } from "../api/response";
import { getUser } from "../api/user";
import { resolveMediaUrl } from "../utils/media";

function mergeMessages(current, next) {
    const byId = new Map();

    for (const item of current) {
        byId.set(item.id, item);
    }

    for (const item of next) {
        byId.set(item.id, item);
    }

    return [...byId.values()].sort((a, b) => a.id - b.id);
}

function ChatPage() {
    const { id } = useParams();
    const peerId = Number(id);
    const [messages, setMessages] = useState([]);
    const [peer, setPeer] = useState(null);
    const [draft, setDraft] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const lastMessageIdRef = useRef(0);

    const loadConversation = useCallback(async (isBackgroundRefresh = false) => {
        if (!id) {
            return;
        }

        if (!isBackgroundRefresh) {
            setLoading(true);
        }

        setError("");

        try {
            const response = await getConversation(id);
            const nextMessages = Array.isArray(response) ? response : [];

            setMessages(nextMessages);
            if (nextMessages.length > 0) {
                const matchedPeer = nextMessages[0].sender.id === peerId
                    ? nextMessages[0].sender
                    : nextMessages[0].recipient.id === peerId
                        ? nextMessages[0].recipient
                        : null;
                setPeer(matchedPeer);
                lastMessageIdRef.current = nextMessages[nextMessages.length - 1].id;
            } else {
                const profile = await getUser(id);
                setPeer(profile || null);
            }
        } catch (err) {
            setError(getApiErrorMessage(err));
            if (!isBackgroundRefresh) {
                setMessages([]);
                setPeer(null);
            }
        } finally {
            if (!isBackgroundRefresh) {
                setLoading(false);
            }
        }
    }, [id, peerId]);

    async function handleSubmit(event) {
        event.preventDefault();

        const trimmedDraft = draft.trim();

        if (!trimmedDraft) {
            return;
        }

        setSending(true);
        setError("");

        try {
            const createdMessage = await sendMessage(id, trimmedDraft);
            setMessages((current) => mergeMessages(current, [createdMessage]));
            lastMessageIdRef.current = Math.max(lastMessageIdRef.current, createdMessage.id);
            setDraft("");
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSending(false);
        }
    }

    useEffect(() => {
        async function initialLoad() {
            await loadConversation();
        }

        initialLoad();
    }, [id, loadConversation]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        async function listen() {
            while (!cancelled && id) {
                try {
                    const updates = await waitForMessageUpdates(lastMessageIdRef.current, controller.signal);

                    if (cancelled) {
                        return;
                    }

                    if (updates.length === 0) {
                        continue;
                    }

                    const newestId = updates[updates.length - 1].id;
                    lastMessageIdRef.current = Math.max(lastMessageIdRef.current, newestId);

                    const relevantMessages = updates.filter((item) =>
                        item.sender_id === peerId || item.recipient_id === peerId
                    );

                    if (relevantMessages.length > 0) {
                        await loadConversation(true);
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
    }, [id, loadConversation, peerId]);

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">Chat</h1>
                    <p className="page-subtitle">
                        {peer
                            ? `Conversation with ${peer.display_name || peer.username}`
                            : "Open and continue a direct conversation."}
                    </p>
                </div>

                <div className="page-actions">
                    {peer?.id && (
                        <Link className="btn btn--secondary" to={`/users/${peer.id}`}>
                            Open profile
                        </Link>
                    )}
                    <Link className="btn btn--secondary" to="/messages">
                        Back to chats
                    </Link>
                </div>
            </div>

            {loading && <div className="muted-box">Loading conversation...</div>}
            {error && <div className="muted-box">{error}</div>}

            {!loading && (
                <div className="card chat-window">
                    <div className="card__body chat-window__body">
                        {peer && (
                            <div className="chat-window__header">
                                <img className="avatar avatar--md" src={resolveMediaUrl(peer.avatar_url)} alt="" />
                                <div>
                                    <div className="user-card__name">{peer.display_name || peer.username}</div>
                                    <div className="user-card__meta">@{peer.username}</div>
                                </div>
                            </div>
                        )}

                        <div className="chat-messages">
                            {messages.map((message) => {
                                const isOwn = message.sender_id !== peerId;

                                return (
                                    <div
                                        key={message.id}
                                        className={`chat-bubble ${isOwn ? "chat-bubble--own" : ""}`}
                                    >
                                        <div className="chat-bubble__author">
                                            {message.sender.display_name || message.sender.username}
                                        </div>
                                        <div className="chat-bubble__body">{message.body}</div>
                                    </div>
                                );
                            })}

                            {messages.length === 0 && (
                                <div className="muted-box">
                                    No messages yet. Send the first one to start the conversation.
                                </div>
                            )}
                        </div>

                        <form className="chat-form" onSubmit={handleSubmit}>
                            <textarea
                                className="field__textarea"
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                placeholder="Write a message..."
                            />
                            <div className="form-actions">
                                <button className="btn btn--primary" type="submit" disabled={sending}>
                                    {sending ? "Sending..." : "Send"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatPage;
