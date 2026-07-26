import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getConversation, sendMediaMessage, sendMessage, waitForMessageUpdates } from "../api/message";
import { getApiErrorMessage } from "../api/response";
import { getUser } from "../api/user";
import ChatPeerStatus from "../components/ChatPeerStatus";
import LazyHlsAudio from "../components/LazyHlsAudio";
import LazyHlsVideo from "../components/LazyHlsVideo";
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
    const [recordingType, setRecordingType] = useState("");
    const [error, setError] = useState("");
    const lastMessageIdRef = useRef(0);
    const recorderRef = useRef(null);
    const recorderChunksRef = useRef([]);
    const recorderStreamRef = useRef(null);

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

    function getRecordingMimeType(mediaType) {
        const candidates = mediaType === "video"
            ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
            : ["audio/webm;codecs=opus", "audio/webm"];

        return candidates.find((item) => window.MediaRecorder?.isTypeSupported(item)) || "";
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error("Failed to read recording"));
            reader.readAsDataURL(blob);
        });
    }

    const stopRecorderStream = useCallback(() => {
        if (recorderStreamRef.current) {
            recorderStreamRef.current.getTracks().forEach((track) => track.stop());
            recorderStreamRef.current = null;
        }
    }, []);

    async function startRecording(mediaType) {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setError("Recording is not supported in this browser");
            return;
        }

        setError("");

        try {
            const stream = await navigator.mediaDevices.getUserMedia(
                mediaType === "video" ? { audio: true, video: true } : { audio: true }
            );
            const mimeType = getRecordingMimeType(mediaType);
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

            recorderChunksRef.current = [];
            recorderStreamRef.current = stream;
            recorderRef.current = recorder;
            setRecordingType(mediaType);

            recorder.ondataavailable = (event) => {
                if (event.data?.size > 0) {
                    recorderChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                const chunks = recorderChunksRef.current;
                const type = recorder.mimeType || (mediaType === "video" ? "video/webm" : "audio/webm");
                recorderRef.current = null;
                recorderChunksRef.current = [];
                setRecordingType("");
                stopRecorderStream();

                if (chunks.length === 0) {
                    return;
                }

                setSending(true);

                try {
                    const blob = new Blob(chunks, { type });
                    const file = await blobToDataUrl(blob);
                    const createdMessage = await sendMediaMessage(id, {
                        mediaType,
                        file,
                        filename: `${mediaType}-message-${Date.now()}.webm`,
                        body: draft.trim()
                    });
                    setMessages((current) => mergeMessages(current, [createdMessage]));
                    lastMessageIdRef.current = Math.max(lastMessageIdRef.current, createdMessage.id);
                    setDraft("");
                } catch (err) {
                    setError(getApiErrorMessage(err));
                } finally {
                    setSending(false);
                }
            };

            recorder.start();
        } catch (err) {
            stopRecorderStream();
            setRecordingType("");
            setError(getApiErrorMessage(err));
        }
    }

    function stopRecording() {
        if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
        }
    }

    function renderMessageMedia(message) {
        const mediaId = message.media_asset_id || "";
        const source = mediaId ? `hls:${mediaId}` : "";

        if (message.message_kind === "audio" && source) {
            return (
                <div className="chat-bubble__media chat-bubble__media--audio">
                    <LazyHlsAudio src={source} mediaId={mediaId} showProcessingDetails={false} />
                </div>
            );
        }

        if (message.message_kind === "video" && source) {
            return (
                <div className="chat-bubble__media chat-bubble__media--video">
                    <LazyHlsVideo src={source} mediaId={mediaId} showProcessingDetails={false} />
                </div>
            );
        }

        return null;
    }

    useEffect(() => {
        async function initialLoad() {
            await loadConversation();
        }

        initialLoad();
    }, [id, loadConversation]);

    useEffect(() => () => {
        if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
        }
        stopRecorderStream();
    }, [stopRecorderStream]);

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
                                    <ChatPeerStatus userId={peer.id} />
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
                                        {message.body && <div className="chat-bubble__body">{message.body}</div>}
                                        {renderMessageMedia(message)}
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
                                {recordingType ? (
                                    <button className="btn btn--danger" type="button" onClick={stopRecording}>
                                        Stop {recordingType}
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            className="btn btn--secondary"
                                            type="button"
                                            onClick={() => startRecording("audio")}
                                            disabled={sending}
                                        >
                                            Record audio
                                        </button>
                                        <button
                                            className="btn btn--secondary"
                                            type="button"
                                            onClick={() => startRecording("video")}
                                            disabled={sending}
                                        >
                                            Record video
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatPage;
