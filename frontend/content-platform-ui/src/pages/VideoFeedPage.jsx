import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createVideo, getPosts } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import EmptyState from "../components/EmptyState";
import ScrollToTopButton from "../components/ScrollToTopButton";
import { resolveMediaUrl } from "../utils/media";
import { readFileAsDataUrl } from "../utils/postForm";
import { useToast } from "../context/useToast";

function getVideoPoster(post) {
    return post?.preview_url || post?.image?.feed_thumbnail_url || post?.image?.thumbnail_url || "";
}

function getVideoLikes(post) {
    if (typeof post?.reaction_count === "number") {
        return post.reaction_count;
    }

    return Number(post?.reaction_count || 0);
}

function VideoFeedPage() {
    const fileInputRef = useRef(null);
    const { showToast } = useToast();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadAsPost, setUploadAsPost] = useState(false);
    const [error, setError] = useState("");

    const loadVideos = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await getPosts({
                postKind: "video",
                limit: 30,
                sort: "new"
            });
            setPosts(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(getApiErrorMessage(err));
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadVideos();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [loadVideos]);

    function openFilePicker() {
        fileInputRef.current?.click();
    }

    async function handleFileChange(event) {
        const file = event.target.files?.[0] || null;
        event.target.value = "";

        if (!file) {
            return;
        }

        setUploading(true);
        setError("");

        try {
            const dataUrl = await readFileAsDataUrl(file);
            await createVideo({
                title: file.name.replace(/\.[^.]+$/, "") || "Video",
                description: "Uploaded video",
                filename: file.name,
                file: dataUrl,
                access: { type: "free", price: 0 },
                tags: ["video"],
                uploadAsPost
            });
            showToast("Video upload started", "success");
            await loadVideos();
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">Videos</h1>
                </div>

                <div className="page-actions">
                    <input
                        ref={fileInputRef}
                        className="visually-hidden"
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                    />
                    <button
                        className="btn btn--primary"
                        type="button"
                        onClick={openFilePicker}
                        disabled={uploading}
                    >
                        {uploading ? "Uploading..." : "Upload video"}
                    </button>
                    <label className="checkbox-field checkbox-field--inline">
                        <input
                            type="checkbox"
                            checked={uploadAsPost}
                            onChange={(event) => setUploadAsPost(event.target.checked)}
                            disabled={uploading}
                        />
                        <span>Upload as post</span>
                    </label>
                    <button className="btn btn--secondary" type="button" onClick={loadVideos} disabled={loading}>
                        Refresh
                    </button>
                </div>
            </div>

            {loading && <EmptyState>Loading videos...</EmptyState>}
            {error && <EmptyState>{error}</EmptyState>}
            {!loading && !error && posts.length === 0 && (
                <EmptyState>Upload a video to create the first video post.</EmptyState>
            )}

            <div className="video-grid">
                {posts.map((post) => (
                    <article key={`video-${post.id}`} className="video-card">
                        <Link className="video-card__preview" to={`/posts/${post.id}`}>
                            {getVideoPoster(post) ? (
                                <img src={resolveMediaUrl(getVideoPoster(post))} alt="" loading="lazy" />
                            ) : (
                                <div className="video-card__placeholder">Preparing video</div>
                            )}
                        </Link>
                        <div className="video-card__body">
                            <Link className="video-card__avatar-link" to={`/users/${post.author_id}`}>
                                <img className="avatar avatar--sm" src={resolveMediaUrl(post.author_avatar_url)} alt="" />
                            </Link>
                            <div className="video-card__meta">
                                <Link className="video-card__title" to={`/posts/${post.id}`}>
                                    {post.title || `Video #${post.id}`}
                                </Link>
                                <Link className="video-card__author" to={`/users/${post.author_id}`}>
                                    {post.authorName || post.author_username || `User #${post.author_id}`}
                                </Link>
                                <div className="video-card__stats">
                                    <span>{getVideoLikes(post)} likes</span>
                                    <span>{post.created_at ? new Date(post.created_at).toLocaleDateString() : ""}</span>
                                </div>
                            </div>
                            <Link className="video-card__menu" to={`/posts/${post.id}`} aria-label="Open video">
                                &#8942;
                            </Link>
                        </div>
                    </article>
                ))}
            </div>

            <ScrollToTopButton />
        </div>
    );
}

export default VideoFeedPage;
