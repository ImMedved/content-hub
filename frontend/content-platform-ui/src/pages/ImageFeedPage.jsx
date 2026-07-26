import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getImages } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import EmptyState from "../components/EmptyState";
import ImageGrid from "../components/ImageGrid";
import ImageViewerModal from "../components/ImageViewerModal";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/useToast";

function ImageFeedPage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [mode, setMode] = useState("following");
    const [limit, setLimit] = useState(40);
    const [images, setImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadImages = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await getImages({
                scope: mode,
                limit
            });
            setImages(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(getApiErrorMessage(err));
            setImages([]);
        } finally {
            setLoading(false);
        }
    }, [mode, limit]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadImages();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [loadImages]);

    async function handleRefresh() {
        await loadImages();
        showToast("Grid refreshed", "success");
    }

    const selectedIndex = selectedImage ? images.findIndex((item) => item.id === selectedImage.id) : -1;

    function navigateSelectedImage(direction) {
        if (selectedIndex < 0) {
            return;
        }

        const nextIndex = selectedIndex + direction;
        if (nextIndex >= 0 && nextIndex < images.length) {
            setSelectedImage(images[nextIndex]);
        }
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">{mode === "following" ? "Following grid" : "All images"}</h1>
                </div>
                <div className="page-actions">
                    <button className="btn btn--secondary" type="button" onClick={handleRefresh}>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="feed-content-tabs">
                <Link className="feed-content-tabs__item" to="/">
                    Posts
                </Link>
                <Link className="feed-content-tabs__item feed-content-tabs__item--active" to="/images">
                    Images
                </Link>
                <Link className="feed-content-tabs__item" to="/videos">
                    Videos
                </Link>
                <Link className="feed-content-tabs__item" to="/audio">
                    Audio
                </Link>
                <Link className="feed-content-tabs__item" to="/tracks">
                    Tracks
                </Link>
            </div>

            <div className="feed-toolbar card">
                <div className="card__body feed-toolbar__body feed-toolbar__body--compact">
                    <label className="field">
                        <span className="field__label">Mode</span>
                        <select className="field__select" value={mode} onChange={(event) => setMode(event.target.value)}>
                            <option value="following">Following</option>
                            <option value="all">All images</option>
                        </select>
                    </label>
                </div>
            </div>

            {loading && <EmptyState>Loading image grid...</EmptyState>}
            {error && <EmptyState>{error}</EmptyState>}
            {!loading && !error && (
                <>
                    <ImageGrid
                        images={images}
                        onOpen={setSelectedImage}
                        emptyText={mode === "following" ? "No images from followed users yet." : "No images yet."}
                    />

                    {mode === "all" && images.length >= limit && (
                        <div className="form-actions">
                            <button className="btn btn--secondary" type="button" onClick={() => setLimit((current) => current + 40)}>
                                Load more
                            </button>
                        </div>
                    )}
                </>
            )}

            <ImageViewerModal
                image={selectedImage}
                currentUserId={user?.id}
                onClose={() => setSelectedImage(null)}
                hasPrevious={selectedIndex > 0}
                hasNext={selectedIndex >= 0 && selectedIndex < images.length - 1}
                onNavigatePrevious={() => navigateSelectedImage(-1)}
                onNavigateNext={() => navigateSelectedImage(1)}
            />
        </div>
    );
}

export default ImageFeedPage;
