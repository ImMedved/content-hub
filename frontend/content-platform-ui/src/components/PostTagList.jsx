function PostTagList({ tags, onApplyTag = null, onCopyTag = null }) {
    if (!Array.isArray(tags) || tags.length === 0) {
        return null;
    }

    return (
        <div className="post-tag-list">
            {tags.map((tag) => (
                <div key={tag} className="post-tag-list__item">
                    <button
                        className="tag-chip"
                        type="button"
                        onClick={() => onApplyTag && onApplyTag(tag)}
                        disabled={!onApplyTag}
                    >
                        #{tag}
                    </button>
                    {onCopyTag && (
                        <button
                            className="tag-chip tag-chip--subtle"
                            type="button"
                            onClick={() => onCopyTag(tag)}
                        >
                            Copy
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

export default PostTagList;
