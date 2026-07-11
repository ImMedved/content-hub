import { Link, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { getPost, updatePost } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import PostComposerForm from "../components/PostComposerForm";
import { normalizePostDetail } from "../utils/post";
import { mapPostToFormValues } from "../utils/postForm";

function EditPostPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadPost = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await getPost(id);
            const normalized = normalizePostDetail(response);

            if (!normalized?.id) {
                throw new Error("Post was not found");
            }

            setPost(normalized);
        } catch (err) {
            setError(getApiErrorMessage(err));
            setPost(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadPost();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [loadPost]);

    async function handleSubmit(payload) {
        await updatePost(id, payload);
        navigate(`/posts/${id}`, {
            replace: true,
            state: { success: "Post updated" }
        });
    }

    if (loading) {
        return <div className="muted-box">Loading post editor...</div>;
    }

    if (error || !post) {
        return (
            <div className="page-stack">
                <div className="muted-box">{error || "Post was not found."}</div>
                <Link className="btn btn--secondary" to="/">
                    Back to feed
                </Link>
            </div>
        );
    }

    return (
        <PostComposerForm
            key={`edit-${post.id}`}
            formId={`edit-${post.id}`}
            title="Edit post"
            subtitle="Update content, access settings, tags, and preview media."
            initialValues={mapPostToFormValues(post)}
            submitLabel="Save changes"
            submittingLabel="Saving..."
            onSubmit={handleSubmit}
            secondaryAction={(
                <Link className="btn btn--secondary" to={`/posts/${post.id}`}>
                    Cancel
                </Link>
            )}
        />
    );
}

export default EditPostPage;
