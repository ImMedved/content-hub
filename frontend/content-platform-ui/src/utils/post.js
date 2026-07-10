export function normalizePostDetail(data) {
    if (!data?.post) {
        return null;
    }

    return {
        ...data.post,
        content: Array.isArray(data.content) ? data.content : [],
        access: data.access || null,
        tags: Array.isArray(data.tags) ? data.tags : []
    };
}
