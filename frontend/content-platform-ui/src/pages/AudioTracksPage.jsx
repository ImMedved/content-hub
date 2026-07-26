import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getFeed } from "../api/feed";
import { getPosts } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import EmptyState from "../components/EmptyState";
import LazyHlsAudio from "../components/LazyHlsAudio";
import ScrollToTopButton from "../components/ScrollToTopButton";
import { resolveMediaUrl } from "../utils/media";

function getAudioItem(post) {
    return (Array.isArray(post?.content) ? post.content : []).find((item) =>
        (item.content_type || item.type) === "audio" && (item.content_url || item.value)
    );
}

function AudioTracksPage() {
    const [mode, setMode] = useState("following");
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadTracks = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = mode === "following"
                ? await getFeed()
                : await getPosts({ postKind: "audio", limit: 60, sort: "new" });
            const audioPosts = (Array.isArray(data) ? data : []).filter((post) =>
                post.post_kind === "audio" && getAudioItem(post)
            );
            setTracks(audioPosts);
        } catch (err) {
            setError(getApiErrorMessage(err));
            setTracks([]);
        } finally {
            setLoading(false);
        }
    }, [mode]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadTracks();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [loadTracks]);

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">{mode === "following" ? "Following tracks" : "All tracks"}</h1>
                </div>

                <div className="page-actions">
                    <button className="btn btn--secondary" type="button" onClick={loadTracks} disabled={loading}>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="feed-content-tabs">
                <Link className="feed-content-tabs__item" to="/">
                    Posts
                </Link>
                <Link className="feed-content-tabs__item" to="/images">
                    Images
                </Link>
                <Link className="feed-content-tabs__item" to="/videos">
                    Videos
                </Link>
                <Link className="feed-content-tabs__item" to="/audio">
                    Audio
                </Link>
                <Link className="feed-content-tabs__item feed-content-tabs__item--active" to="/tracks">
                    Tracks
                </Link>
            </div>

            <div className="feed-toolbar card">
                <div className="card__body feed-toolbar__body feed-toolbar__body--compact">
                    <label className="field">
                        <span className="field__label">Mode</span>
                        <select className="field__select" value={mode} onChange={(event) => setMode(event.target.value)}>
                            <option value="following">Following</option>
                            <option value="all">All tracks</option>
                        </select>
                    </label>
                </div>
            </div>

            {loading && <EmptyState>Loading tracks...</EmptyState>}
            {error && <EmptyState>{error}</EmptyState>}
            {!loading && !error && tracks.length === 0 && (
                <EmptyState>{mode === "following" ? "No tracks from followed users yet." : "No tracks uploaded yet."}</EmptyState>
            )}

            <div className="track-list">
                {tracks.map((post, index) => {
                    const item = getAudioItem(post);
                    const mediaUrl = item.content_url || item.value;
                    const mediaId = item.media_id || item.media_asset_id || item.mediaId || "";

                    return (
                        <div key={`track-${post.id}`} className="track-row">
                            <div className="track-row__index">{index + 1}</div>
                            <img className="avatar avatar--sm" src={resolveMediaUrl(post.author_avatar_url)} alt="" />
                            <div className="track-row__main">
                                <Link className="track-row__title" to={`/posts/${post.id}`}>
                                    {post.title || `Track #${post.id}`}
                                </Link>
                                <Link className="track-row__artist" to={`/users/${post.author_id}`}>
                                    {post.authorName || post.author_username || `User #${post.author_id}`}
                                </Link>
                            </div>
                            <div className="track-row__player">
                                <LazyHlsAudio src={mediaUrl} mediaId={mediaId} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <ScrollToTopButton />
        </div>
    );
}

export default AudioTracksPage;
