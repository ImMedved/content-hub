import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createAudio, getPosts } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import EmptyState from "../components/EmptyState";
import LazyHlsAudio from "../components/LazyHlsAudio";
import ScrollToTopButton from "../components/ScrollToTopButton";
import { resolveMediaUrl } from "../utils/media";
import { useToast } from "../context/useToast";
import { readFileAsDataUrl } from "../utils/postForm";

function getAudioItem(post) {
    const content = Array.isArray(post?.content) ? post.content : [];
    return content.find((item) => (item.content_type || item.type) === "audio") || null;
}

function AudioFeedPage() {
    const fileInputRef = useRef(null);
    const { showToast } = useToast();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadAsPost, setUploadAsPost] = useState(false);
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
                tags: ["audio"],
                uploadAsPost
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
                    <h1 className="page-title">Music</h1>
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
                    <label className="checkbox-field checkbox-field--inline">
                        <input
                            type="checkbox"
                            checked={uploadAsPost}
                            onChange={(event) => setUploadAsPost(event.target.checked)}
                            disabled={uploading}
                        />
                        <span>Upload as post</span>
                    </label>
                    <button className="btn btn--secondary" type="button" onClick={loadAudios} disabled={loading}>
                        Refresh
                    </button>
                </div>
            </div>

            {loading && <EmptyState>Loading audio...</EmptyState>}
            {error && <EmptyState>{error}</EmptyState>}
            {!loading && !error && posts.length === 0 && (
                <EmptyState>Upload an audio file to create the first audio post.</EmptyState>
            )}

            <div className="music-list">
                {posts.map((post) => {
                    const audioItem = getAudioItem(post);
                    const audioSource = audioItem?.content_url || audioItem?.value || "";
                    const mediaId = audioItem?.media_id || audioItem?.media_asset_id || audioItem?.mediaId || "";

                    return (
                        <article key={`audio-${post.id}`} className="music-row">
                            <Link className="music-row__avatar" to={`/users/${post.author_id}`}>
                                <img className="avatar avatar--sm" src={resolveMediaUrl(post.author_avatar_url)} alt="" />
                            </Link>
                            <div className="music-row__main">
                                <Link className="music-row__title" to={`/posts/${post.id}`}>
                                    {post.title || `Track #${post.id}`}
                                </Link>
                                <Link className="music-row__author" to={`/users/${post.author_id}`}>
                                    {post.authorName || post.author_username || `User #${post.author_id}`}
                                </Link>
                            </div>
                            <div className="music-row__player">
                                {audioSource ? (
                                    <LazyHlsAudio src={audioSource} mediaId={mediaId} />
                                ) : (
                                    <div className="muted-box">Preparing audio...</div>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>

            <ScrollToTopButton />
        </div>
    );
}

export default AudioFeedPage;
