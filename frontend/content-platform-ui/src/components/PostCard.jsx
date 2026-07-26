import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { deletePost, getPost, pinPost, purchasePost } from "../api/post";
import { addReaction, getReactionUsers, getReactions, removeReaction } from "../api/reactions";
import { getApiErrorMessage } from "../api/response";
import { useToast } from "../context/useToast";
import { useAuth } from "../context/auth-context";
import { resolveMediaUrl } from "../utils/media";
import { normalizePostDetail } from "../utils/post";
import useRevealOnScroll from "../utils/useRevealOnScroll";
import CommentThread from "./CommentThread";
import LazyHlsAudio from "./LazyHlsAudio";
import LazyHlsVideo from "./LazyHlsVideo";
import PostTagList from "./PostTagList";

function PostCard({
    post,
    showOpenButton = true,
    showBackButton = false,
    showManagementActions = false,
    onBack = null,
    onPurchased = null,
    onPostDeleted = null,
    onPostPinned = null,
    onTagApply = null,
    compact = false,
    animateOnScroll = false
}) {
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const location = useLocation();
    const [postOverride, setPostOverride] = useState(null);
    const [reactions, setReactions] = useState([]);
    const [viewerReaction, setViewerReaction] = useState(null);
    const [reactionUsers, setReactionUsers] = useState([]);
    const [reactionLoading, setReactionLoading] = useState(false);
    const [purchaseLoading, setPurchaseLoading] = useState(false);
    const [managementLoading, setManagementLoading] = useState(false);
    const [likersLoading, setLikersLoading] = useState(false);
    const [reactionError, setReactionError] = useState("");
    const [purchaseError, setPurchaseError] = useState("");
    const [showLikers, setShowLikers] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const { elementRef, isVisible } = useRevealOnScroll(animateOnScroll);

    const currentPost = postOverride?.id === post?.id ? postOverride : post;
    const postId = currentPost?.id ?? null;
    const isAuthor = Number(user?.id) === Number(currentPost?.author_id);
    const canManagePost = showManagementActions && isAuthor;
    const isLocked = Boolean(currentPost?.is_locked);
    const canViewContent = Boolean(currentPost?.can_view_content);
    const isBought = currentPost?.access_type === "paid" && canViewContent && !isAuthor;
    const postLinkState = {
        from: location.pathname + location.search,
        scrollY: window.scrollY
    };

    const loadReactions = useCallback(async () => {
        try {
            const response = await getReactions(postId);
            if (Array.isArray(response)) {
                setReactions(response);
                setViewerReaction(null);
            } else {
                setReactions(Array.isArray(response?.reactions) ? response.reactions : []);
                setViewerReaction(response?.viewerReaction || null);
            }
            setReactionError("");
        } catch (err) {
            setReactionError(getApiErrorMessage(err));
            setReactions([]);
            setViewerReaction(null);
        }
    }, [postId]);

    const loadReactionUsers = useCallback(async () => {
        setLikersLoading(true);

        try {
            const data = await getReactionUsers(postId);
            setReactionUsers(Array.isArray(data) ? data : []);
            setReactionError("");
        } catch (err) {
            setReactionError(getApiErrorMessage(err));
            setReactionUsers([]);
        } finally {
            setLikersLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        if (!postId || isLocked) {
            return;
        }

        const timeoutId = setTimeout(() => {
            loadReactions();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [postId, isLocked, loadReactions]);

    async function handleCopyPostLink() {
        await navigator.clipboard.writeText(`${window.location.origin}/posts/${currentPost.id}`);
        setLinkCopied(true);
        showToast("Post link copied", "success");

        setTimeout(() => {
            setLinkCopied(false);
        }, 2000);
    }

    async function handleCopyTag(tag) {
        await navigator.clipboard.writeText(`#${tag}`);
        showToast("Tag copied", "success");
    }

    async function handleLike() {
        setReactionLoading(true);
        setReactionError("");

        try {
            if (viewerReaction === "like") {
                await removeReaction(currentPost.id);
            } else {
                await addReaction(currentPost.id);
            }
            await loadReactions();

            if (showLikers) {
                await loadReactionUsers();
            }
        } catch (err) {
            setReactionError(getApiErrorMessage(err));
        } finally {
            setReactionLoading(false);
        }
    }

    async function handlePurchase() {
        setPurchaseLoading(true);
        setPurchaseError("");

        try {
            await purchasePost(currentPost.id);
            const refreshed = normalizePostDetail(await getPost(currentPost.id));

            if (refreshed) {
                setPostOverride(refreshed);
            }

            await refreshUser();

            if (typeof onPurchased === "function") {
                await onPurchased(refreshed || currentPost);
            }

            showToast("Post purchased", "success");
        } catch (err) {
            setPurchaseError(getApiErrorMessage(err));
        } finally {
            setPurchaseLoading(false);
        }
    }

    async function handleToggleLikers() {
        const nextState = !showLikers;
        setShowLikers(nextState);

        if (nextState) {
            await loadReactionUsers();
        }
    }

    async function handleDeletePost() {
        const isConfirmed = window.confirm("Delete this post?");

        if (!isConfirmed) {
            return;
        }

        setManagementLoading(true);
        setPurchaseError("");

        try {
            await deletePost(currentPost.id);
            showToast("Post deleted", "success");

            if (typeof onPostDeleted === "function") {
                await onPostDeleted(currentPost);
            }
        } catch (err) {
            setPurchaseError(getApiErrorMessage(err));
        } finally {
            setManagementLoading(false);
        }
    }

    async function handlePinPost() {
        setManagementLoading(true);
        setPurchaseError("");

        try {
            await pinPost(currentPost.id);
            setPostOverride((current) => ({
                ...(current || currentPost),
                is_pinned: true
            }));
            showToast("Post pinned", "success");

            if (typeof onPostPinned === "function") {
                await onPostPinned(currentPost);
            }
        } catch (err) {
            setPurchaseError(getApiErrorMessage(err));
        } finally {
            setManagementLoading(false);
        }
    }

    function renderSingleMediaItem(item, dense = false) {
        const itemType = item.content_type || item.type;
        const textValue = item.text_content || (itemType === "text" ? item.value : "");
        const mediaUrl = item.content_url || (itemType !== "text" ? item.value : "");
        const key = item.id || `${itemType}-${mediaUrl || textValue}`;

        if (itemType === "image" && mediaUrl) {
            const mediaClassName = `${dense ? "post-card__grid-media" : "post-card__media"}${
                currentPost?.post_kind === "image" && showOpenButton ? " post-card__media--feed-image" : ""
            }`;
            return (
                <div key={key} className={mediaClassName}>
                    <img src={resolveMediaUrl(mediaUrl)} alt="" />
                </div>
            );
        }

        if (itemType === "video" && mediaUrl) {
            return (
                <div key={key} className={dense ? "post-card__grid-media" : "post-card__media"}>
                    <LazyHlsVideo
                        src={mediaUrl}
                        mediaId={item.media_id || item.media_asset_id || item.mediaId || ""}
                        posterUrl={currentPost.preview_url || ""}
                    />
                </div>
            );
        }

        if (itemType === "audio" && mediaUrl) {
            return (
                <div key={key} className="post-card__audio">
                    <LazyHlsAudio
                        src={mediaUrl}
                        mediaId={item.media_id || item.media_asset_id || item.mediaId || ""}
                    />
                </div>
            );
        }

        if (textValue) {
            return <p key={key}>{textValue}</p>;
        }

        return null;
    }

    function renderContentItems() {
        const contentItems = Array.isArray(currentPost.content) ? currentPost.content : [];
        const imageItems = contentItems.filter((item) => (item.content_type || item.type) === "image");
        const otherItems = contentItems.filter((item) => (item.content_type || item.type) !== "image");
        const renderedItems = otherItems.map((item) => renderSingleMediaItem(item)).filter(Boolean);

        if (imageItems.length > 1) {
            renderedItems.push(
                <div className="post-card__media-grid" key="media-grid">
                    {imageItems.slice(0, 9).map((item) => renderSingleMediaItem(item, true))}
                </div>
            );
        } else if (imageItems.length === 1) {
            renderedItems.push(renderSingleMediaItem(imageItems[0]));
        }

        return renderedItems;
    }

    const totalReactions = reactions.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const shareIcon = (
        <svg className="icon-button__svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a3 3 0 1 0-2.72-4.27L8.91 7.04a3 3 0 1 0 0 1.92l6.37 3.31A3 3 0 1 0 16.2 10.5L9.82 7.19l6.37-3.31A3 3 0 0 0 18 8Z" />
        </svg>
    );

    return (
        <article
            ref={elementRef}
            className={
                `card post-card${compact ? " post-card--compact" : ""}` +
                `${animateOnScroll ? " post-card--scroll-reveal" : ""}` +
                `${animateOnScroll && isVisible ? " post-card--is-visible" : ""}`
            }
        >
            {showBackButton && onBack && (
                <div className="post-card__toolbar">
                    <button className="btn btn--secondary" type="button" onClick={onBack}>
                        Back to feed
                    </button>
                </div>
            )}

            <div className="post-card__head">
                <div className="post-card__title-row">
                    <div className="post-card__identity">
                        <img
                            className="avatar avatar--md"
                            src={resolveMediaUrl(currentPost.author_avatar_url)}
                            alt=""
                        />

                        <div className="post-card__identity-body">
                            <div className="post-card__title-inline">
                                <h2 className="post-card__title">
                                    <Link to={`/posts/${currentPost.id}`} state={postLinkState}>
                                        {currentPost.title || `Post #${currentPost.id}`}
                                    </Link>
                                </h2>

                                {currentPost.is_pinned && (
                                    <span className="post-card__status-badge">Pinned</span>
                                )}
                                {isBought && (
                                    <span className="post-card__status-badge">Bought</span>
                                )}
                            </div>

                            <div className="post-card__byline">
                                {currentPost.author_id && (
                                    <Link className="post-card__author-link" to={`/users/${currentPost.author_id}`}>
                                        {currentPost.authorName || currentPost.author_username || `User #${currentPost.author_id}`}
                                    </Link>
                                )}
                                {currentPost.created_at && (
                                    <span>{new Date(currentPost.created_at).toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="post-card__corner-actions">
                        {canViewContent && (
                            <button
                                className={`icon-button post-card__like ${viewerReaction === "like" ? "post-card__like--active" : ""}`}
                                type="button"
                                onClick={handleLike}
                                disabled={reactionLoading || !currentPost?.id}
                                aria-label={viewerReaction === "like" ? "Remove like" : "Like"}
                            >
                                &#9829;
                            </button>
                        )}
                        <button
                            className={`icon-button post-card__share ${linkCopied ? "post-card__share--copied" : ""}`}
                            type="button"
                            onClick={handleCopyPostLink}
                            aria-label="Copy post link"
                        >
                            {linkCopied ? "\u2713" : shareIcon}
                        </button>
                    </div>
                </div>

                <div className="post-card__meta">
                    {currentPost.access_type === "paid" && <span>Access: paid</span>}
                    {typeof currentPost.price === "number" && currentPost.access_type === "paid" && (
                        <span>Price: {currentPost.price}</span>
                    )}
                </div>

                <PostTagList
                    tags={currentPost.tags}
                    onApplyTag={onTagApply}
                    onCopyTag={handleCopyTag}
                />
            </div>

            <div className="post-card__content">
                {currentPost.description && (
                    <p className={compact ? "post-card__description-preview" : ""}>{currentPost.description}</p>
                )}

                {canViewContent ? (
                    <div className="post-card__content-items">
                        {Array.isArray(currentPost.content) && currentPost.content.length > 0
                            ? renderContentItems()
                            : <p>Post content is empty.</p>}
                    </div>
                ) : (
                    <div className="muted-box post-card__locked-note">
                        This is a paid post. Purchase it to unlock the content.
                    </div>
                )}
            </div>

            <div className="post-card__actions">
                {!canViewContent && (
                    <button
                        className="btn btn--primary"
                        type="button"
                        onClick={handlePurchase}
                        disabled={purchaseLoading}
                    >
                        {purchaseLoading ? "Purchasing..." : `Buy for ${currentPost.price}`}
                    </button>
                )}

                {canManagePost && (
                    <>
                        <button
                            className="btn btn--secondary"
                            type="button"
                            onClick={handlePinPost}
                            disabled={managementLoading || Boolean(currentPost.is_pinned)}
                        >
                            {currentPost.is_pinned ? "Pinned" : "Pin post"}
                        </button>
                        <Link className="btn btn--secondary" to={`/posts/${currentPost.id}/edit`}>
                            Edit post
                        </Link>
                        <button
                            className="btn btn--danger"
                            type="button"
                            onClick={handleDeletePost}
                            disabled={managementLoading}
                        >
                            Delete post
                        </button>
                    </>
                )}

                {canViewContent && (
                    <button className="post-card__stats" type="button" onClick={handleToggleLikers}>
                        Reactions: {totalReactions}
                    </button>
                )}
            </div>

            {purchaseError && <div className="post-card__message muted-box">{purchaseError}</div>}
            {reactionError && <div className="post-card__message muted-box">{reactionError}</div>}

            {showLikers && (
                <div className="feed-modal-backdrop" onClick={() => setShowLikers(false)} role="presentation">
                    <div className="feed-modal card post-card__likers-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="card__body feed-modal__body">
                            <div className="page-heading">
                                <h2 className="page-title page-title--section">Reactions</h2>
                                <button className="btn btn--secondary" type="button" onClick={() => setShowLikers(false)}>
                                    Close
                                </button>
                            </div>

                            {likersLoading && <div className="muted-box">Loading likers...</div>}

                            {!likersLoading && reactionUsers.length === 0 && (
                                <div className="muted-box">No likes yet.</div>
                            )}

                            <div className="user-grid user-grid--compact">
                                {reactionUsers.map((item) => (
                                    <Link key={`${item.id}-${item.created_at}`} className="user-card" to={`/users/${item.id}`}>
                                        <img
                                            className="avatar avatar--sm"
                                            src={resolveMediaUrl(item.avatar_url)}
                                            alt=""
                                        />
                                        <div>
                                            <div className="user-card__name">
                                                {item.display_name || item.username}
                                            </div>
                                            <div className="user-card__meta">@{item.username}</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!canViewContent && (
                <div className="post-card__message muted-box post-card__locked-comments-note">
                    Comments are unavailable until you purchase this post.
                </div>
            )}

            {canViewContent && !compact && (
                <CommentThread
                    postId={currentPost.id}
                    postAuthorId={currentPost.author_id}
                    currentUserId={user?.id}
                />
            )}
        </article>
    );
}

export default PostCard;
