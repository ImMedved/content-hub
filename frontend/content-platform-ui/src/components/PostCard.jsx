/*
Post card
*/

import { Link, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import CommentItem from "./CommentItem";
import { createComment, getComments } from "../api/comments";
import { addReaction, getReactionUsers, getReactions, removeReaction } from "../api/reactions";
import { getPost, purchasePost } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import { useAuth } from "../context/auth-context";
import { resolveMediaUrl } from "../utils/media";
import { normalizePostDetail } from "../utils/post";

function PostCard({
    post,
    showOpenButton = true,
    showBackButton = false,
    onBack = null,
    onPurchased = null,
    onTagClick = null,
    compact = false
}) {
    const { user, refreshUser } = useAuth();
    const location = useLocation();
    const [postOverride, setPostOverride] = useState(null);
    const [comments, setComments] = useState([]);
    const [text, setText] = useState("");
    const [reactions, setReactions] = useState([]);
    const [reactionUsers, setReactionUsers] = useState([]);
    const [commentLoading, setCommentLoading] = useState(false);
    const [reactionLoading, setReactionLoading] = useState(false);
    const [purchaseLoading, setPurchaseLoading] = useState(false);
    const [likersLoading, setLikersLoading] = useState(false);
    const [commentError, setCommentError] = useState("");
    const [reactionError, setReactionError] = useState("");
    const [purchaseError, setPurchaseError] = useState("");
    const [hasReacted, setHasReacted] = useState(false);
    const [showLikers, setShowLikers] = useState(false);

    const currentPost = postOverride?.id === post?.id ? postOverride : post;
    const postId = currentPost?.id ?? null;
    const isAuthor = Number(user?.id) === Number(currentPost?.author_id);
    const isLocked = Boolean(currentPost?.is_locked);
    const canViewContent = Boolean(currentPost?.can_view_content);
    const isBought =
        currentPost?.access_type === "paid" &&
        canViewContent &&
        !isAuthor;
    const postLinkState = {
        from: location.pathname + location.search,
        scrollY: window.scrollY
    };

    const loadComments = useCallback(async () => {
        try {
            const res = await getComments(postId);
            setComments(Array.isArray(res) ? res : []);
            setCommentError("");
        } catch (err) {
            setCommentError(getApiErrorMessage(err));
            setComments([]);
        }
    }, [postId]);

    const loadReactions = useCallback(async () => {
        try {
            const res = await getReactions(postId);
            setReactions(Array.isArray(res) ? res : []);
            setReactionError("");
        } catch (err) {
            setReactionError(getApiErrorMessage(err));
            setReactions([]);
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

        async function syncPostMeta() {
            await Promise.all([loadComments(), loadReactions()]);
        }

        syncPostMeta();
    }, [postId, isLocked, loadComments, loadReactions]);

    async function handleComment() {
        setCommentLoading(true);
        setCommentError("");

        try {
            await createComment({
                postId: currentPost.id,
                content: text.trim()
            });

            setText("");
            await loadComments();
        } catch (err) {
            setCommentError(getApiErrorMessage(err));
        } finally {
            setCommentLoading(false);
        }
    }

    async function handleLike() {
        setReactionLoading(true);
        setReactionError("");

        try {
            await addReaction(currentPost.id);
            setHasReacted(true);
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

    async function handleRemoveReaction() {
        setReactionLoading(true);
        setReactionError("");

        try {
            await removeReaction(currentPost.id);
            setHasReacted(false);
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

    function renderContentItem(item) {
        const itemType = item.content_type || item.type;
        const textValue = item.text_content || (itemType === "text" ? item.value : "");
        const mediaUrl = item.content_url || (itemType !== "text" ? item.value : "");
        const key = item.id || `${itemType}-${mediaUrl || textValue}`;

        if (itemType === "image" && mediaUrl) {
            return (
                <div key={key} className="post-card__media">
                    <img src={resolveMediaUrl(mediaUrl)} alt="" />
                </div>
            );
        }

        if (itemType === "video" && mediaUrl) {
            return (
                <div key={key} className="post-card__media">
                    <video src={resolveMediaUrl(mediaUrl)} controls />
                </div>
            );
        }

        if (textValue) {
            return <p key={key}>{textValue}</p>;
        }

        return null;
    }

    return (
        <article className={`card post-card${compact ? " post-card--compact" : ""}`}>
            {showBackButton && onBack && (
                <div className="post-card__toolbar">
                    <button className="btn btn--secondary" onClick={onBack}>
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

                        <div>
                            <div className="post-card__title-inline">
                                <h2 className="post-card__title">
                                    <Link to={`/posts/${currentPost.id}`} state={postLinkState}>
                                        {currentPost.title || `Post #${currentPost.id}`}
                                    </Link>
                                </h2>

                                {isBought && <span className="post-card__status-badge">Bought</span>}
                            </div>

                            {currentPost.author_id && (
                                <Link className="post-card__author-link" to={`/users/${currentPost.author_id}`}>
                                    {currentPost.authorName || currentPost.author_username || `User #${currentPost.author_id}`}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                <div className="post-card__meta">
                    <span>{currentPost.created_at ? new Date(currentPost.created_at).toLocaleString() : ""}</span>
                    {currentPost.access_type && <span>Access: {currentPost.access_type}</span>}
                    {typeof currentPost.price === "number" && currentPost.access_type === "paid" && (
                        <span>Price: {currentPost.price}</span>
                    )}
                </div>

                {Array.isArray(currentPost.tags) && currentPost.tags.length > 0 && (
                    <div className="tag-row">
                        {currentPost.tags.map((tag) => (
                            <button
                                key={tag}
                                className="tag-chip"
                                onClick={() => onTagClick && onTagClick(tag)}
                                disabled={!onTagClick}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="post-card__content">
                {currentPost.description && (
                    <p className={compact ? "post-card__description-preview" : ""}>{currentPost.description}</p>
                )}

                {canViewContent ? (
                    <div className="post-card__content-items">
                        {Array.isArray(currentPost.content) && currentPost.content.length > 0
                            ? currentPost.content.map(renderContentItem)
                            : <p>Post content is empty.</p>}
                    </div>
                ) : (
                    <div className="muted-box post-card__locked-note">
                        This is a paid post. Purchase it to unlock the content.
                    </div>
                )}
            </div>

            <div className="post-card__actions">
                {canViewContent ? (
                    <>
                        <button
                            className="btn btn--secondary"
                            onClick={handleLike}
                            disabled={reactionLoading || !currentPost?.id}
                        >
                            Like
                        </button>

                        <button
                            className="btn btn--secondary"
                            onClick={handleRemoveReaction}
                            disabled={reactionLoading || !currentPost?.id || !hasReacted}
                        >
                            Remove reaction
                        </button>
                    </>
                ) : (
                    <button
                        className="btn btn--primary"
                        onClick={handlePurchase}
                        disabled={purchaseLoading}
                    >
                        {purchaseLoading ? "Purchasing..." : `Buy for ${currentPost.price}`}
                    </button>
                )}

                {showOpenButton && (
                    <Link className="btn btn--secondary" to={`/posts/${currentPost.id}`} state={postLinkState}>
                        Open post
                    </Link>
                )}

                {isAuthor && canViewContent && (
                    <button className="btn btn--secondary" onClick={handleToggleLikers}>
                        {showLikers ? "Hide likers" : "View likers"}
                    </button>
                )}

                <div className="post-card__stats">
                    {reactions.length > 0
                        ? reactions.map((item) => `${item.type}: ${item.count}`).join(" | ")
                        : "No reactions yet"}
                </div>
            </div>

            {purchaseError && <div className="post-card__message muted-box">{purchaseError}</div>}
            {reactionError && <div className="post-card__message muted-box">{reactionError}</div>}

            {showLikers && (
                <div className="post-card__likers">
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
            )}

            {!canViewContent && (
                <div className="post-card__message muted-box post-card__locked-comments-note">
                    Comments are unavailable until you purchase this post.
                </div>
            )}

            {canViewContent && !compact && (
                <div className="post-card__comments">
                    <h3 className="comments-title">Comments</h3>

                    {comments.length > 0 ? (
                        <div className="comment-list">
                            {comments.map((comment) => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    actions={null}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="muted-box">No comments yet.</div>
                    )}

                    {/*
                    Ready-to-enable comment moderation controls.
                    Backend and API hooks already exist:
                    - PUT /api/v1/comments/:id
                    - DELETE /api/v1/comments/:id
                    Deletion now supports both:
                    - the comment author
                    - the post author
                    Uncomment the state/handlers below together with the actions block if you want to expose it.

                    const [editingCommentId, setEditingCommentId] = useState(null);
                    const [editingCommentText, setEditingCommentText] = useState("");

                    async function handleDeleteComment(commentId) {
                        setCommentLoading(true);
                        setCommentError("");

                        try {
                            await deleteComment(commentId);
                            await loadComments();
                        } catch (err) {
                            setCommentError(getApiErrorMessage(err));
                        } finally {
                            setCommentLoading(false);
                        }
                    }

                    async function handleSaveCommentEdit(commentId) {
                        setCommentLoading(true);
                        setCommentError("");

                        try {
                            await updateComment(commentId, editingCommentText);
                            setEditingCommentId(null);
                            setEditingCommentText("");
                            await loadComments();
                        } catch (err) {
                            setCommentError(getApiErrorMessage(err));
                        } finally {
                            setCommentLoading(false);
                        }
                    }

                    const canDeleteComment =
                        Number(user?.id) === Number(comment.author_id) ||
                        Number(user?.id) === Number(currentPost?.author_id);

                    const canEditComment = Number(user?.id) === Number(comment.author_id);

                    actions={
                        <div className="comment-item__actions">
                            {canEditComment && (
                                <button
                                    className="btn btn--secondary"
                                    type="button"
                                    onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditingCommentText(comment.content || "");
                                    }}
                                >
                                    Edit
                                </button>
                            )}
                            {canDeleteComment && (
                                <button
                                    className="btn btn--danger"
                                    type="button"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    disabled={commentLoading}
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    }
                    */}

                    {commentError && <div className="muted-box">{commentError}</div>}

                    <div className="comment-form">
                        <div className="comment-form__row">
                            <textarea
                                className="field__textarea"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                disabled={commentLoading || !currentPost?.id}
                                placeholder="Write a comment"
                            />
                        </div>

                        <button
                            className="btn btn--primary"
                            onClick={handleComment}
                            disabled={commentLoading || !text.trim() || !currentPost?.id}
                        >
                            {commentLoading ? "Saving..." : "Add comment"}
                        </button>
                    </div>
                </div>
            )}
        </article>
    );
}

export default PostCard;
