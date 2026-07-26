import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createAudio, getPosts } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import EmptyState from "../components/EmptyState";
import PostCard from "../components/PostCard";
import ScrollToTopButton from "../components/ScrollToTopButton";
import { useToast } from "../context/useToast";
import { readFileAsDataUrl } from "../utils/postForm";

function AudioFeedPage() {
    const fileInputRef = useRef(null);
    const { showToast } = useToast();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const loadAudios = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await getPosts({
                postKind: "audio",
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
            loadAudios();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [loadAudios]);

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
            await createAudio({
                title: file.name.replace(/\.[^.]+$/, "") || "Audio",
                description: "Uploaded audio",
                filename: file.name,
                file: dataUrl,
                access: { type: "free", price: 0 },
                tags: ["audio"]
            });
            showToast("Audio upload started", "success");
            await loadAudios();
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
                    <h1 className="page-title">Audio</h1>
                </div>

                <div className="page-actions">
                    <input
                        ref={fileInputRef}
                        className="visually-hidden"
                        type="file"
                        accept="audio/*"
                        onChange={handleFileChange}
                    />
                    <button
                        className="btn btn--primary"
                        type="button"
                        onClick={openFilePicker}
                        disabled={uploading}
                    >
                        {uploading ? "Uploading..." : "Upload audio"}
                    </button>
                    <button className="btn btn--secondary" type="button" onClick={loadAudios} disabled={loading}>
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
                <Link className="feed-content-tabs__item feed-content-tabs__item--active" to="/audio">
                    Audio
                </Link>
                <Link className="feed-content-tabs__item" to="/tracks">
                    Tracks
                </Link>
            </div>

            {loading && <EmptyState>Loading audio...</EmptyState>}
            {error && <EmptyState>{error}</EmptyState>}
            {!loading && !error && posts.length === 0 && (
                <EmptyState>Upload an audio file to create the first audio post.</EmptyState>
            )}

            <div className="post-list">
                {posts.map((post) => (
                    <PostCard key={`audio-${post.id}`} post={post} animateOnScroll />
                ))}
            </div>

            <ScrollToTopButton />
        </div>
    );
}

export default AudioFeedPage;
