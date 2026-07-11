import TagAutocompleteField from "./TagAutocompleteField";

function FeedFiltersModal({
    draftIncludeTags,
    draftExcludeTags,
    draftBoughtOnly,
    draftAuthorQuery,
    includeInput,
    excludeInput,
    includeSuggestions,
    excludeSuggestions,
    onIncludeInputChange,
    onExcludeInputChange,
    onSelectIncludeTag,
    onSelectExcludeTag,
    onRemoveIncludeTag,
    onRemoveExcludeTag,
    onAuthorQueryChange,
    onBoughtOnlyChange,
    onApply,
    onClear,
    onClose
}) {
    return (
        <div className="feed-modal-backdrop" onClick={onClose} role="presentation">
            <div className="feed-modal card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                <div className="card__body feed-modal__body">
                    <div className="feed-modal__header">
                        <div>
                            <h2 className="page-title page-title--section">Search by tags</h2>
                            <p className="page-subtitle">Filter the feed by tags, author, and purchased content.</p>
                        </div>
                    </div>

                    <TagAutocompleteField
                        label="Choose tags"
                        selectedTags={draftIncludeTags}
                        inputValue={includeInput}
                        suggestions={includeSuggestions}
                        placeholder="Start typing a tag"
                        onInputChange={onIncludeInputChange}
                        onSelectTag={onSelectIncludeTag}
                        onRemoveTag={onRemoveIncludeTag}
                    />

                    <TagAutocompleteField
                        label="Exclude tags"
                        selectedTags={draftExcludeTags}
                        inputValue={excludeInput}
                        suggestions={excludeSuggestions}
                        placeholder="Start typing a tag"
                        onInputChange={onExcludeInputChange}
                        onSelectTag={onSelectExcludeTag}
                        onRemoveTag={onRemoveExcludeTag}
                    />

                    <label className="field">
                        <span className="field__label">Author</span>
                        <input
                            className="field__input"
                            value={draftAuthorQuery}
                            onChange={(event) => onAuthorQueryChange(event.target.value)}
                            placeholder="Username or display name"
                        />
                    </label>

                    <label className="checkbox-field" htmlFor="bought-only-filter">
                        <input
                            id="bought-only-filter"
                            type="checkbox"
                            checked={draftBoughtOnly}
                            onChange={(event) => onBoughtOnlyChange(event.target.checked)}
                        />
                        <span>Show only bought paid posts</span>
                    </label>

                    <div className="form-actions">
                        <button className="btn btn--primary" type="button" onClick={onApply}>
                            Apply filters
                        </button>
                        <button className="btn btn--secondary" type="button" onClick={onClear}>
                            Clear
                        </button>
                        <button className="btn btn--secondary" type="button" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FeedFiltersModal;
