import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../api/response";
import { POST_TITLE_LIMIT } from "../utils/postLimits";
import { usePostDraft } from "../utils/usePostDraft";
import { buildPostPayload, createPostFormState } from "../utils/postForm";

function PostComposerForm({
    formId,
    title,
    subtitle,
    initialValues = {},
    submitLabel,
    submittingLabel,
    storageKey = "",
    onSubmit,
    secondaryAction = null
}) {
    const [form, setForm] = useState(() => createPostFormState(initialValues));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const { clearDraft } = usePostDraft(storageKey, form, setForm);
    const previewFileUrl = useMemo(
        () => (form.imageFile ? URL.createObjectURL(form.imageFile) : ""),
        [form.imageFile]
    );
    const previewUrl = previewFileUrl || form.imageUrl.trim();

    useEffect(() => {
        return () => {
            if (previewFileUrl) {
                URL.revokeObjectURL(previewFileUrl);
            }
        };
    }, [previewFileUrl]);

    function updateField(fieldName, value) {
        setForm((current) => ({
            ...current,
            [fieldName]: value
        }));
    }

    function handleImageFileChange(event) {
        const file = event.target.files?.[0] || null;

        setForm((current) => ({
            ...current,
            imageFile: file,
            imageUrl: file ? "" : current.imageUrl
        }));
    }

    function clearSelectedImage() {
        setForm((current) => ({
            ...current,
            imageFile: null,
            imageUrl: ""
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const payload = await buildPostPayload(form);
            await onSubmit(payload);
            clearDraft();
        } catch (err) {
            setError(getApiErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">{title}</h1>
                    {subtitle && <p className="page-subtitle">{subtitle}</p>}
                </div>
            </div>

            <div className="card">
                <div className="card__body">
                    <form className="form-grid" id={formId} onSubmit={handleSubmit}>
                        <label className="field">
                            <span className="field__label">Title</span>
                            <input
                                className="field__input"
                                placeholder="Post title"
                                value={form.title}
                                maxLength={POST_TITLE_LIMIT}
                                onChange={(event) => updateField("title", event.target.value)}
                                disabled={submitting}
                            />
                            <span className="field__hint">
                                {form.title.length}/{POST_TITLE_LIMIT}
                            </span>
                        </label>

                        <label className="field">
                            <span className="field__label">Description</span>
                            <input
                                className="field__input"
                                placeholder="Short description"
                                value={form.description}
                                onChange={(event) => updateField("description", event.target.value)}
                                disabled={submitting}
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Tags</span>
                            <input
                                className="field__input"
                                placeholder="design, music, premium"
                                value={form.tagsInput}
                                onChange={(event) => updateField("tagsInput", event.target.value)}
                                disabled={submitting}
                            />
                        </label>

                        <div className="form-grid form-grid--two">
                            <label className="field">
                                <span className="field__label">Access type</span>
                                <select
                                    className="field__select"
                                    value={form.accessType}
                                    onChange={(event) => updateField("accessType", event.target.value)}
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
                                    value={form.price}
                                    onChange={(event) => updateField("price", event.target.value)}
                                    disabled={submitting || form.accessType !== "paid"}
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span className="field__label">Text content</span>
                            <textarea
                                className="field__textarea"
                                placeholder="Write your post text"
                                value={form.text}
                                onChange={(event) => updateField("text", event.target.value)}
                                disabled={submitting}
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Image file</span>
                            <input
                                className="field__input"
                                type="file"
                                accept="image/*"
                                onChange={handleImageFileChange}
                                disabled={submitting}
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Image URL fallback</span>
                            <input
                                className="field__input"
                                placeholder="https://..."
                                value={form.imageUrl}
                                onChange={(event) => updateField("imageUrl", event.target.value)}
                                disabled={submitting || Boolean(form.imageFile)}
                            />
                        </label>

                        {previewUrl && (
                            <div className="post-preview card">
                                <div className="card__body post-preview__body">
                                    <div className="post-preview__header">
                                        <span className="field__label">Image preview</span>
                                        <button
                                            className="btn btn--secondary"
                                            type="button"
                                            onClick={clearSelectedImage}
                                            disabled={submitting}
                                        >
                                            Clear image
                                        </button>
                                    </div>
                                    <img className="post-preview__image" src={previewUrl} alt="" />
                                </div>
                            </div>
                        )}

                        {error && <div className="muted-box">{error}</div>}

                        <div className="form-actions">
                            <button className="btn btn--primary" type="submit" disabled={submitting}>
                                {submitting ? submittingLabel : submitLabel}
                            </button>
                            {secondaryAction}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default PostComposerForm;
