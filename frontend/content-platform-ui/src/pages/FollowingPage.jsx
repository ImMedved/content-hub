import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyFollowing } from "../api/user";
import { getApiErrorMessage } from "../api/response";
import { resolveMediaUrl } from "../utils/media";

function FollowingPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function loadUsers() {
        setLoading(true);
        setError("");

        try {
            const data = await getMyFollowing();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(getApiErrorMessage(err));
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        async function initialLoad() {
            await loadUsers();
        }

        initialLoad();
    }, []);

    return (
        <div className="page-stack">
            <div className="page-heading">
                <h1 className="page-title">Following</h1>
                <p className="page-subtitle">Users whose posts shape your feed.</p>
            </div>

            {loading && <div className="muted-box">Loading users...</div>}
            {error && <div className="muted-box">{error}</div>}

            {!loading && !error && users.length === 0 && (
                <div className="muted-box">You are not following anyone yet.</div>
            )}

            <div className="user-grid">
                {users.map((item) => (
                    <Link key={item.id} className="user-card" to={`/users/${item.id}`}>
                        <img
                            className="avatar avatar--lg"
                            src={resolveMediaUrl(item.avatar_url)}
                            alt=""
                        />
                        <div>
                            <div className="user-card__name">
                                {item.display_name || item.username}
                            </div>
                            <div className="user-card__meta">@{item.username}</div>
                            <div className="user-card__meta">{item.status || "active"}</div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default FollowingPage;
