import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../utils/media";

function getImagePreview(post) {
    return post?.image?.thumbnail_url || post?.image?.feed_thumbnail_url || post?.preview_url || null;
}

function isVideoPost(post) {
    const content = Array.isArray(post?.content) ? post.content : [];

    return post?.post_kind === "video" || content.some((item) => (item.content_type || item.type) === "video");
}

function ImageGrid({ images, limit = null, onOpen = null, emptyText = "No images yet.", linkTo = null }) {
    const visibleImages = Number.isFinite(limit) ? images.slice(0, limit) : images;

    if (!Array.isArray(images) || images.length === 0) {
        return <div className="muted-box">{emptyText}</div>;
    }

    return (
        <div className="image-grid">
            {visibleImages.map((post, index) => {
                const previewUrl = getImagePreview(post);
                const isVideo = isVideoPost(post);
                const content = previewUrl ? (
                    <>
                        <img
                            src={resolveMediaUrl(previewUrl)}
                            alt={post.title || ""}
                            loading="lazy"
                        />
                        {isVideo && <span className="image-grid__video-badge">Play</span>}
                    </>
                ) : (
                    <div className="image-grid__pending">Processing</div>
                );

                if (typeof onOpen === "function" && !isVideo) {
                    return (
                        <button key={`${post.id}-${index}`} className="image-grid__item" type="button" onClick={() => onOpen(post)}>
                            {content}
                        </button>
                    );
                }

                return (
                    <Link key={`${post.id}-${index}`} className="image-grid__item" to={linkTo || `/posts/${post.id}`}>
                        {content}
                    </Link>
                );
            })}
        </div>
    );
}

export default ImageGrid;
