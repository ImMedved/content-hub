import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/response";
import { getMyFollowing } from "../api/user";
import { resolveMediaUrl } from "../utils/media";

function NewChatPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function loadFollowing() {
        setLoading(true);
        setError("");

        try {
            const response = await getMyFollowing();
            setUsers(Array.isArray(response) ? response : []);
        } catch (err) {
            setError(getApiErrorMessage(err));
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        async function initialLoad() {
            await loadFollowing();
        }

        initialLoad();
    }, []);

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">Start a new chat</h1>
                    <p className="page-subtitle">You can begin a conversation with any user you already follow.</p>
                </div>

                <Link className="btn btn--secondary" to="/messages">
                    Back to chats
                </Link>
            </div>

            {loading && <div className="muted-box">Loading following list...</div>}
            {error && <div className="muted-box">{error}</div>}

            {!loading && (
                <div className="user-grid">
                    {users.map((item) => (
                        <Link key={item.id} className="user-card" to={`/messages/${item.id}`}>
                            <img className="avatar avatar--md" src={resolveMediaUrl(item.avatar_url)} alt="" />
                            <div>
                                <div className="user-card__name">{item.display_name || item.username}</div>
                                <div className="user-card__meta">@{item.username}</div>
                            </div>
                        </Link>
                    ))}

                    {users.length === 0 && (
                        <div className="muted-box">
                            Follow someone first, then they will appear here for a new chat.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default NewChatPage;
