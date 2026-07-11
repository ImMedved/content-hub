function ChatSearchField({ value, onChange }) {
    return (
        <label className="field chat-search-field">
            <span className="field__label">Search chat</span>
            <input
                className="field__input"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Search by name or username"
            />
        </label>
    );
}

export default ChatSearchField;
