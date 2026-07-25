import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { addReaction, getReactions, removeReaction } from "../api/reactions";
import { getApiErrorMessage } from "../api/response";
import { resolveMediaUrl } from "../utils/media";
import CommentThread from "./CommentThread";
import PostTagList from "./PostTagList";

function ImageViewerModal({
    image,
    currentUserId,
    onClose,
    onTagApply = null,
    onNavigatePrevious = null,
    onNavigateNext = null,
    hasPrevious = false,
    hasNext = false
}) {
    const [reactions, setReactions] = useState([]);
    const [reactionError, setReactionError] = useState("");
    const [reactionLoading, setReactionLoading] = useState(false);
    const postId = image?.id;

    const loadReactions = useCallback(async () => {
        if (!postId) {
            return;
        }

        try {
            const response = await getReactions(postId);
            setReactions(Array.isArray(response) ? response : []);
            setReactionError("");
        } catch (err) {
            setReactionError(getApiErrorMessage(err));
            setReactions([]);
        }
    }, [postId]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadReactions();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [loadReactions]);

    useEffect(() => {
        if (!image) {
            return undefined;
        }

        function handleKeyDown(event) {
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                event.preventDefault();
                if (hasNext && typeof onNavigateNext === "function") {
                    onNavigateNext();
                }
            }

            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                event.preventDefault();
                if (hasPrevious && typeof onNavigatePrevious === "function") {
                    onNavigatePrevious();
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [hasNext, hasPrevious, image, onNavigateNext, onNavigatePrevious]);

    if (!image) {
        return null;
    }

    const imageUrl = image.image?.compressed_url || image.image?.feed_thumbnail_url || null;
    const ocrText = image.image?.ocr_text;

    async function handleLike() {
        setReactionLoading(true);
        setReactionError("");

        try {
            await addReaction(postId);
            await loadReactions();
        } catch (err) {
            setReactionError(getApiErrorMessage(err));
        } finally {
            setReactionLoading(false);
        }
    }

    async function handleRemoveReaction() {
        setReactionLoading(true);
        setReactionError("");

        try {
            await removeReaction(postId);
            await loadReactions();
        } catch (err) {
            setReactionError(getApiErrorMessage(err));
        } finally {
            setReactionLoading(false);
        }
    }

    return (
        <div className="feed-modal-backdrop image-viewer-backdrop" onClick={onClose} role="presentation">
            <div className="image-viewer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                <div className="image-viewer__media">
                    <button
                        className="image-viewer__nav image-viewer__nav--prev"
                        type="button"
                        aria-label="Previous image"
                        onClick={onNavigatePrevious}
                        disabled={!hasPrevious || typeof onNavigatePrevious !== "function"}
                    >
                        &lt;
                    </button>
                    {imageUrl ? (
                        <img src={resolveMediaUrl(imageUrl)} alt={image.title || ""} />
                    ) : (
                        <div className="image-viewer__pending">Processing image</div>
                    )}
                    <button
                        className="image-viewer__nav image-viewer__nav--next"
                        type="button"
                        aria-label="Next image"
                        onClick={onNavigateNext}
                        disabled={!hasNext || typeof onNavigateNext !== "function"}
                    >
                        &gt;
                    </button>
                </div>

                <aside className="image-viewer__side">
                    <div className="image-viewer__top">
                        <div>
                            <h2 className="page-title page-title--section">{image.title || "Image"}</h2>
                            {image.author_id && (
                                <Link className="post-card__author-link" to={`/users/${image.author_id}`}>
                                    {image.authorName || image.author_username || `User #${image.author_id}`}
                                </Link>
                            )}
                        </div>
                        <button className="btn btn--secondary" type="button" onClick={onClose}>
                            Close
                        </button>
                    </div>

                    {image.description && <p className="image-viewer__description">{image.description}</p>}

                    <PostTagList tags={image.tags} onApplyTag={onTagApply} />

                    <div className="image-viewer__meta">
                        <span>{image.created_at ? new Date(image.created_at).toLocaleString() : ""}</span>
                        {image.image?.analysis_status && <span>Analysis: {image.image.analysis_status}</span>}
                    </div>

                    <div className="image-viewer__reactions">
                        <div className="form-actions">
                            <button className="btn btn--secondary" type="button" onClick={handleLike} disabled={reactionLoading || !currentUserId}>
                                Like
                            </button>
                            <button className="btn btn--secondary" type="button" onClick={handleRemoveReaction} disabled={reactionLoading || !currentUserId}>
                                Remove reaction
                            </button>
                        </div>
                        <div className="post-card__stats">
                            {reactions.length > 0
                                ? reactions.map((item) => `${item.type}: ${item.count}`).join(" | ")
                                : "No reactions yet"}
                        </div>
                        {reactionError && <div className="muted-box">{reactionError}</div>}
                    </div>

                    {ocrText && (
                        <div className="muted-box image-viewer__ocr">
                            <strong>OCR</strong>
                            <p>{ocrText}</p>
                        </div>
                    )}

                    <CommentThread
                        postId={image.id}
                        postAuthorId={image.author_id}
                        currentUserId={currentUserId}
                    />
                </aside>
            </div>
        </div>
    );
}

export default ImageViewerModal;
