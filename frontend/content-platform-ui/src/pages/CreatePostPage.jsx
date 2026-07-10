import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPost } from "../api/post";
import { getApiErrorMessage } from "../api/response";

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function CreatePostPage() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [text, setText] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [tagsInput, setTagsInput] = useState("");
    const [accessType, setAccessType] = useState("free");
    const [price, setPrice] = useState("0");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    async function handleCreate(event) {
        event.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const content = [];

            if (text.trim()) {
                content.push({ type: "text", value: text.trim() });
            }

            if (imageFile) {
                const dataUrl = await readFileAsDataUrl(imageFile);
                content.push({ type: "image", value: dataUrl });
            } else if (imageUrl.trim()) {
                content.push({ type: "image", value: imageUrl.trim() });
            }

            const result = await createPost({
                title,
                description,
                content,
                tags: tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
                access: {
                    type: accessType,
                    price: Number(price || 0)
                }
            });

            navigate(`/posts/${result.postId}`, { replace: true });
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <h1 className="page-title">Create post</h1>
                <p className="page-subtitle">Publish free or paid content, with tags and an uploaded image.</p>
            </div>

            <div className="card">
                <div className="card__body">
                    <form className="form-grid" onSubmit={handleCreate}>
                        <label className="field">
                            <span className="field__label">Title</span>
                            <input
                                className="field__input"
                                placeholder="Post title"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                disabled={submitting}
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Description</span>
                            <input
                                className="field__input"
                                placeholder="Short description"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                disabled={submitting}
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Tags</span>
                            <input
                                className="field__input"
                                placeholder="design, music, premium"
                                value={tagsInput}
                                onChange={(event) => setTagsInput(event.target.value)}
                                disabled={submitting}
                            />
                        </label>

                        <div className="form-grid form-grid--two">
                            <label className="field">
                                <span className="field__label">Access type</span>
                                <select
                                    className="field__select"
                                    value={accessType}
                                    onChange={(event) => setAccessType(event.target.value)}
                                    disabled={submitting}
                                >
                                    <option value="free">Free</option>
                                    <option value="paid">Paid</option>
                                </select>
                            </label>

                            <label className="field">
                                <span className="field__label">Price</span>
                                <input
                                    className="field__input"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={price}
                                    onChange={(event) => setPrice(event.target.value)}
                                    disabled={submitting || accessType !== "paid"}
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span className="field__label">Text content</span>
                            <textarea
                                className="field__textarea"
                                placeholder="Write your post text"
                                value={text}
                                onChange={(event) => setText(event.target.value)}
                                disabled={submitting}
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Image file</span>
                            <input
                                className="field__input"
                                type="file"
                                accept="image/*"
                                onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                                disabled={submitting}
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Image URL fallback</span>
                            <input
                                className="field__input"
                                placeholder="https://..."
                                value={imageUrl}
                                onChange={(event) => setImageUrl(event.target.value)}
                                disabled={submitting || Boolean(imageFile)}
                            />
                        </label>

                        {error && <div className="muted-box">{error}</div>}

                        <div className="form-actions">
                            <button className="btn btn--primary" type="submit" disabled={submitting}>
                                {submitting ? "Publishing..." : "Publish"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default CreatePostPage;
