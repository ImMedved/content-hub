function TagAutocompleteField({
    label,
    selectedTags,
    inputValue,
    suggestions,
    placeholder,
    onInputChange,
    onSelectTag,
    onRemoveTag
}) {
    return (
        <label className="field">
            <span className="field__label">{label}</span>
            <div className="tag-picker">
                <div className="tag-picker__control">
                    {selectedTags.map((tag) => (
                        <button
                            key={tag}
                            className="tag-picker__chip"
                            type="button"
                            onClick={() => onRemoveTag(tag)}
                        >
                            <span>#{tag}</span>
                            <span className="tag-picker__chip-remove">x</span>
                        </button>
                    ))}

                    <input
                        className="tag-picker__input"
                        value={inputValue}
                        placeholder={placeholder}
                        onChange={(event) => onInputChange(event.target.value)}
                    />
                </div>

                {suggestions.length > 0 && (
                    <div className="tag-picker__suggestions">
                        {suggestions.map((tag) => (
                            <button
                                key={`${label}-${tag}`}
                                className="tag-picker__suggestion"
                                type="button"
                                onClick={() => onSelectTag(tag)}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </label>
    );
}

export default TagAutocompleteField;
