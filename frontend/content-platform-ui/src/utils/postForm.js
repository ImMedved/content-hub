export function createPostFormState(initialValues = {}) {
    return {
        title: initialValues.title || "",
        description: initialValues.description || "",
        text: initialValues.text || "",
        imageUrl: initialValues.imageUrl || "",
        imageFile: null,
        tagsInput: initialValues.tagsInput || "",
        accessType: initialValues.accessType || "free",
        price: initialValues.price || "0"
    };
}

export function mapPostToFormValues(post) {
    const content = Array.isArray(post?.content) ? post.content : [];
    const textItem = content.find((item) => (item.content_type || item.type) === "text");
    const imageItem = content.find((item) => (item.content_type || item.type) === "image");

    return {
        title: post?.title || "",
        description: post?.description || "",
        text: textItem?.text_content || textItem?.value || "",
        imageUrl: imageItem?.content_url || imageItem?.value || "",
        tagsInput: Array.isArray(post?.tags) ? post.tags.join(", ") : "",
        accessType: post?.access_type || "free",
        price: typeof post?.price === "number" ? String(post.price) : "0"
    };
}

export function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export async function buildPostPayload(form) {
    const content = [];

    if (form.text.trim()) {
        content.push({ type: "text", value: form.text.trim() });
    }

    if (form.imageFile) {
        const dataUrl = await readFileAsDataUrl(form.imageFile);
        content.push({ type: "image", value: dataUrl });
    } else if (form.imageUrl.trim()) {
        content.push({ type: "image", value: form.imageUrl.trim() });
    }

    return {
        title: form.title.trim(),
        description: form.description.trim(),
        content,
        tags: form.tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        access: {
            type: form.accessType,
            price: Number(form.price || 0)
        }
    };
}
