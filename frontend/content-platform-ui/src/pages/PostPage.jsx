import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getPost } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import PostCard from "../components/PostCard";
import { normalizePostDetail } from "../utils/post";

function PostPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
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
        async function initialLoad() {
            await loadPost();
        }

        initialLoad();
    }, [id, loadPost]);

    function handleBack() {
        if (location.state?.from) {
            navigate(location.state.from, {
                state: { restoreScrollY: location.state.scrollY || 0 }
            });
            return;
        }

        navigate("/");
    }

    return (
        <div className="post-page">
            <h1 className="page-title">Post</h1>

            {loading && <div className="muted-box">Loading post...</div>}
            {error && <div className="muted-box">{error}</div>}
            {post && !loading && (
                <PostCard
                    post={post}
                    showOpenButton={false}
                    showBackButton
                    onBack={handleBack}
                    onPurchased={loadPost}
                />
            )}
        </div>
    );
}

export default PostPage;
