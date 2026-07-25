import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createVideo, getPosts } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import EmptyState from "../components/EmptyState";
import PostCard from "../components/PostCard";
import ScrollToTopButton from "../components/ScrollToTopButton";
import { readFileAsDataUrl } from "../utils/postForm";
import { useToast } from "../context/useToast";

function VideoFeedPage() {
    const fileInputRef = useRef(null);
    const { showToast } = useToast();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
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
                tags: ["video"]
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
                    <button className="btn btn--secondary" type="button" onClick={loadVideos} disabled={loading}>
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
                <Link className="feed-content-tabs__item feed-content-tabs__item--active" to="/videos">
                    Videos
                </Link>
            </div>

            {loading && <EmptyState>Loading videos...</EmptyState>}
            {error && <EmptyState>{error}</EmptyState>}
            {!loading && !error && posts.length === 0 && (
                <EmptyState>Upload a video to create the first video post.</EmptyState>
            )}

            <div className="post-list">
                {posts.map((post) => (
                    <PostCard key={`video-${post.id}`} post={post} animateOnScroll />
                ))}
            </div>

            <ScrollToTopButton />
        </div>
    );
}

export default VideoFeedPage;
