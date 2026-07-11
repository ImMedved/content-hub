import { useNavigate } from "react-router-dom";
import { createPost } from "../api/post";
import PostComposerForm from "../components/PostComposerForm";

function CreatePostPage() {
    const navigate = useNavigate();

    async function handleCreate(payload) {
        const result = await createPost(payload);
        navigate(`/posts/${result.postId}`, {
            replace: true,
            state: { success: "Post published" }
        });
    }

    return (
        <PostComposerForm
            formId="create-post"
            title="Create post"
            subtitle="Publish free or paid content, with tags, drafts, and image preview."
            submitLabel="Publish"
            submittingLabel="Publishing..."
            storageKey="create-post-draft"
            onSubmit={handleCreate}
        />
    );
}

export default CreatePostPage;
