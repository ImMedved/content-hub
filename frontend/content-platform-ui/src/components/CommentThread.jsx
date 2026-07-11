import { useCallback, useEffect, useState } from "react";
import { createComment, deleteComment, getComments, updateComment } from "../api/comments";
import { getApiErrorMessage } from "../api/response";
import { useToast } from "../context/useToast";
import { COMMENT_LIMIT } from "../utils/postLimits";
import CommentItem from "./CommentItem";
import EmptyState from "./EmptyState";

function CommentThread({ postId, postAuthorId, currentUserId }) {
    const { showToast } = useToast();
    const [comments, setComments] = useState([]);
    const [draft, setDraft] = useState("");
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const loadComments = useCallback(async () => {
        setLoading(true);

        try {
            const response = await getComments(postId);
            setComments(Array.isArray(response) ? response : []);
            setError("");
        } catch (err) {
            setError(getApiErrorMessage(err));
            setComments([]);
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        if (!postId) {
            return;
        }

        const timeoutId = setTimeout(() => {
            loadComments();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [postId, loadComments]);

    async function handleCreateComment() {
        setSaving(true);
        setError("");

        try {
            await createComment({
                postId,
                content: draft.trim()
            });

            setDraft("");
            await loadComments();
            showToast("Comment added", "success");
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteComment(commentId) {
        const isConfirmed = window.confirm("Delete this comment?");

        if (!isConfirmed) {
            return;
        }

        setSaving(true);
        setError("");

        try {
            await deleteComment(commentId);
            await loadComments();
            showToast("Comment deleted", "success");
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveCommentEdit(commentId) {
        setSaving(true);
        setError("");

        try {
            await updateComment(commentId, editingCommentText.trim());
            setEditingCommentId(null);
            setEditingCommentText("");
            await loadComments();
            showToast("Comment updated", "success");
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="post-card__comments">
            <h3 className="comments-title">Comments</h3>

            {loading && <EmptyState>Loading comments...</EmptyState>}

            {!loading && comments.length === 0 && (
                <EmptyState>No comments yet. Start the conversation.</EmptyState>
            )}

            {!loading && comments.length > 0 && (
                <div className="comment-list">
                    {comments.map((comment) => {
                        const canEditComment = Number(currentUserId) === Number(comment.author_id);
                        const canDeleteComment =
                            canEditComment || Number(currentUserId) === Number(postAuthorId);
                        const isEditing = editingCommentId === comment.id;

                        return (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                actions={(
                                    <div className="comment-item__actions">
                                        <div className="comment-item__button-row">
                                            {canEditComment && (
                                                <button
                                                    className="btn btn--secondary"
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingCommentId(comment.id);
                                                        setEditingCommentText(comment.content || "");
                                                    }}
                                                    disabled={saving}
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {canDeleteComment && (
                                                <button
                                                    className="btn btn--danger"
                                                    type="button"
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                    disabled={saving}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>

                                        {isEditing && (
                                            <div className="comment-item__editor">
                                                <textarea
                                                    className="field__textarea"
                                                    value={editingCommentText}
                                                    maxLength={COMMENT_LIMIT}
                                                    onChange={(event) => setEditingCommentText(event.target.value)}
                                                    disabled={saving}
                                                />
                                                <span className="field__hint">
                                                    {editingCommentText.length}/{COMMENT_LIMIT}
                                                </span>
                                                <div className="comment-item__button-row">
                                                    <button
                                                        className="btn btn--primary"
                                                        type="button"
                                                        onClick={() => handleSaveCommentEdit(comment.id)}
                                                        disabled={saving || !editingCommentText.trim()}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        className="btn btn--secondary"
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingCommentId(null);
                                                            setEditingCommentText("");
                                                        }}
                                                        disabled={saving}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            />
                        );
                    })}
                </div>
            )}

            {error && <EmptyState>{error}</EmptyState>}

            <div className="comment-form">
                <div className="comment-form__row">
                    <textarea
                        className="field__textarea"
                        value={draft}
                        maxLength={COMMENT_LIMIT}
                        onChange={(event) => setDraft(event.target.value)}
                        disabled={saving || !postId}
                        placeholder="Write a comment"
                    />
                </div>
                <span className="field__hint">
                    {draft.length}/{COMMENT_LIMIT}
                </span>

                <button
                    className="btn btn--primary"
                    type="button"
                    onClick={handleCreateComment}
                    disabled={saving || !draft.trim() || !postId}
                >
                    {saving ? "Saving..." : "Add comment"}
                </button>
            </div>
        </div>
    );
}

export default CommentThread;
