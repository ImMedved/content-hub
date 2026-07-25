import { useMemo, useState } from "react";

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function parseTags(value) {
    return String(value || "")
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
}

function ImageUploadModal({ files, onClose, onSubmit, submitting = false }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [items, setItems] = useState(() =>
        files.map((file, index) => ({
            file,
            title: file.name?.replace(/\.[^.]+$/, "") || `Image ${index + 1}`,
            tagsInput: "",
            previewUrl: URL.createObjectURL(file)
        }))
    );

    const activeItem = items[activeIndex] || null;
    const isBatch = items.length > 1;
    const progressLabel = isBatch ? `${activeIndex + 1} / ${items.length}` : "1 image";

    const canGoPrevious = activeIndex > 0;
    const canGoNext = activeIndex < items.length - 1;

    const thumbnails = useMemo(
        () => items.map((item, index) => ({ index, previewUrl: item.previewUrl, title: item.title })),
        [items]
    );

    function updateActiveField(field, value) {
        setItems((current) =>
            current.map((item, index) => index === activeIndex ? { ...item, [field]: value } : item)
        );
    }

    async function buildUploadPayload(sourceItems) {
        return Promise.all(
            sourceItems.map(async (item) => ({
                file: await fileToDataUrl(item.file),
                filename: item.file.name,
                title: item.title,
                tags: parseTags(item.tagsInput)
            }))
        );
    }

    function removeUploadedIndex(indexToRemove) {
        setItems((current) => {
            const nextItems = current.filter((_, index) => index !== indexToRemove);

            if (nextItems.length === 0) {
                setTimeout(onClose, 0);
                return [];
            }

            setActiveIndex((currentIndex) => Math.min(currentIndex, nextItems.length - 1));
            return nextItems;
        });
    }

    async function handleUploadCurrent() {
        if (!activeItem) {
            return;
        }

        const uploadedIndex = activeIndex;
        const images = await buildUploadPayload([activeItem]);
        await onSubmit(images, { background: false });
        removeUploadedIndex(uploadedIndex);
    }

    async function handleUploadAll() {
        const images = await buildUploadPayload(items);
        onSubmit(images, { background: true });
        onClose();
    }

    return (
        <div className="feed-modal-backdrop" onClick={onClose} role="presentation">
            <div className="feed-modal card image-upload-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                <div className="card__body feed-modal__body">
                    <div className="feed-modal__header">
                        <div className="page-heading">
                            <div>
                                <h2 className="page-title page-title--section">Upload images</h2>
                                <p className="page-subtitle">{progressLabel}</p>
                            </div>
                            <button className="btn btn--secondary" type="button" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>

                    {activeItem && (
                        <div className="image-upload-layout">
                            <div className="image-upload-preview">
                                <img src={activeItem.previewUrl} alt="" />
                            </div>

                            <div className="image-upload-form">
                                <label className="field">
                                    <span className="field__label">Title</span>
                                    <input
                                        className="field__input"
                                        value={activeItem.title}
                                        onChange={(event) => updateActiveField("title", event.target.value)}
                                    />
                                </label>

                                <label className="field">
                                    <span className="field__label">Tags</span>
                                    <input
                                        className="field__input"
                                        value={activeItem.tagsInput}
                                        placeholder="portrait, city, night"
                                        onChange={(event) => updateActiveField("tagsInput", event.target.value)}
                                    />
                                    <span className="field__hint">Leave empty to use automatic analysis.</span>
                                </label>

                                {isBatch && (
                                    <div className="image-upload-strip">
                                        {thumbnails.map((item) => (
                                            <button
                                                key={`${item.index}-${item.previewUrl}`}
                                                className={`image-upload-thumb ${item.index === activeIndex ? "image-upload-thumb--active" : ""}`}
                                                type="button"
                                                onClick={() => setActiveIndex(item.index)}
                                                title={item.title}
                                            >
                                                <img src={item.previewUrl} alt="" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="form-actions">
                                    {isBatch && (
                                        <>
                                            <button
                                                className="btn btn--secondary"
                                                type="button"
                                                onClick={() => setActiveIndex((current) => current - 1)}
                                                disabled={!canGoPrevious}
                                            >
                                                Previous
                                            </button>
                                            <button
                                                className="btn btn--secondary"
                                                type="button"
                                                onClick={() => setActiveIndex((current) => current + 1)}
                                                disabled={!canGoNext}
                                            >
                                                Next
                                            </button>
                                        </>
                                    )}
                                    <button className="btn btn--primary" type="button" onClick={handleUploadCurrent} disabled={submitting}>
                                        {submitting ? "Uploading..." : isBatch ? "Upload current" : "Upload"}
                                    </button>
                                    {isBatch && (
                                        <button className="btn btn--secondary" type="button" onClick={handleUploadAll} disabled={submitting}>
                                            Upload all
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ImageUploadModal;
