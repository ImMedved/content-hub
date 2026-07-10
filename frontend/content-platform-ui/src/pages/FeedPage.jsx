/*
Feed page
*/

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getFeed } from "../api/feed";
import { getPosts, getTagSuggestions } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/auth-context";

function normalizeTag(value) {
    return String(value || "").trim().toLowerCase();
}

function isBoughtPost(post, currentUserId = null) {
    return (
        post?.access_type === "paid" &&
        Boolean(post?.can_view_content) &&
        Number(post?.author_id) !== Number(currentUserId)
    );
}

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

function FeedPage() {
    const location = useLocation();
    const { user } = useAuth();
    const [followedPosts, setFollowedPosts] = useState([]);
    const [discoverPosts, setDiscoverPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [discoverLoading, setDiscoverLoading] = useState(true);
    const [error, setError] = useState("");
    const [discoverError, setDiscoverError] = useState("");
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [appliedIncludeTags, setAppliedIncludeTags] = useState([]);
    const [appliedExcludeTags, setAppliedExcludeTags] = useState([]);
    const [appliedBoughtOnly, setAppliedBoughtOnly] = useState(false);
    const [appliedAuthorQuery, setAppliedAuthorQuery] = useState("");
    const [draftIncludeTags, setDraftIncludeTags] = useState([]);
    const [draftExcludeTags, setDraftExcludeTags] = useState([]);
    const [draftBoughtOnly, setDraftBoughtOnly] = useState(false);
    const [draftAuthorQuery, setDraftAuthorQuery] = useState("");
    const [includeInput, setIncludeInput] = useState("");
    const [excludeInput, setExcludeInput] = useState("");
    const [includeSuggestions, setIncludeSuggestions] = useState([]);
    const [excludeSuggestions, setExcludeSuggestions] = useState([]);
    const followedPostIds = new Set(followedPosts.map((post) => Number(post.id)));
    const currentUserId = user?.id ?? null;
    const visibleDiscoverPosts = discoverPosts
        .filter((post) => !followedPostIds.has(Number(post.id)))
        .filter((post) => !appliedBoughtOnly || isBoughtPost(post, currentUserId));

    function handleIncludeInputChange(value) {
        setIncludeInput(value);

        if (!normalizeTag(value)) {
            setIncludeSuggestions([]);
        }
    }

    function handleExcludeInputChange(value) {
        setExcludeInput(value);

        if (!normalizeTag(value)) {
            setExcludeSuggestions([]);
        }
    }

    useEffect(() => {
        async function initialLoad() {
            await loadFeed();
        }

        initialLoad();
    }, []);

    useEffect(() => {
        async function syncDiscover() {
            await loadDiscover(appliedIncludeTags, appliedExcludeTags, appliedAuthorQuery);
        }

        syncDiscover();
    }, [appliedIncludeTags, appliedExcludeTags, appliedAuthorQuery]);

    useEffect(() => {
        if (typeof location.state?.restoreScrollY === "number") {
            window.scrollTo({ top: location.state.restoreScrollY, behavior: "auto" });
        }
    }, [location.state]);

    useEffect(() => {
        if (!isTagModalOpen) {
            return;
        }

        const trimmedValue = normalizeTag(includeInput);

        if (!trimmedValue) {
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                const tags = await getTagSuggestions(trimmedValue);
                setIncludeSuggestions(
                    Array.isArray(tags)
                        ? tags.filter((tag) => !draftIncludeTags.includes(tag) && !draftExcludeTags.includes(tag))
                        : []
                );
            } catch {
                setIncludeSuggestions([]);
            }
        }, 150);

        return () => clearTimeout(timeoutId);
    }, [includeInput, isTagModalOpen, draftIncludeTags, draftExcludeTags]);

    useEffect(() => {
        if (!isTagModalOpen) {
            return;
        }

        const trimmedValue = normalizeTag(excludeInput);

        if (!trimmedValue) {
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                const tags = await getTagSuggestions(trimmedValue);
                setExcludeSuggestions(
                    Array.isArray(tags)
                        ? tags.filter((tag) => !draftExcludeTags.includes(tag) && !draftIncludeTags.includes(tag))
                        : []
                );
            } catch {
                setExcludeSuggestions([]);
            }
        }, 150);

        return () => clearTimeout(timeoutId);
    }, [excludeInput, isTagModalOpen, draftExcludeTags, draftIncludeTags]);

    async function loadFeed() {
        setLoading(true);
        setError("");

        try {
            const data = await getFeed();
            setFollowedPosts(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(getApiErrorMessage(err));
            setFollowedPosts([]);
        } finally {
            setLoading(false);
        }
    }

    async function loadDiscover(includeTags = [], excludeTags = [], authorQuery = "") {
        setDiscoverLoading(true);
        setDiscoverError("");

        try {
            const params = {};

            if (includeTags.length > 0) {
                params.includeTags = includeTags.join(",");
            }

            if (excludeTags.length > 0) {
                params.excludeTags = excludeTags.join(",");
            }

            if (String(authorQuery || "").trim()) {
                params.author = String(authorQuery).trim();
            }

            const data = await getPosts(params);
            setDiscoverPosts(Array.isArray(data) ? data : []);
        } catch (err) {
            setDiscoverError(getApiErrorMessage(err));
            setDiscoverPosts([]);
        } finally {
            setDiscoverLoading(false);
        }
    }

    async function refreshAll() {
        await Promise.all([
            loadFeed(),
            loadDiscover(appliedIncludeTags, appliedExcludeTags, appliedAuthorQuery)
        ]);
    }

    function openTagModal() {
        setDraftIncludeTags(appliedIncludeTags);
        setDraftExcludeTags(appliedExcludeTags);
        setDraftBoughtOnly(appliedBoughtOnly);
        setDraftAuthorQuery(appliedAuthorQuery);
        setIncludeInput("");
        setExcludeInput("");
        setIncludeSuggestions([]);
        setExcludeSuggestions([]);
        setIsTagModalOpen(true);
    }

    function closeTagModal() {
        setIsTagModalOpen(false);
        setIncludeInput("");
        setExcludeInput("");
        setIncludeSuggestions([]);
        setExcludeSuggestions([]);
    }

    function addDraftTag(kind, rawTag) {
        const normalizedTag = normalizeTag(rawTag);

        if (!normalizedTag) {
            return;
        }

        if (kind === "include") {
            setDraftIncludeTags((current) => current.includes(normalizedTag) ? current : [...current, normalizedTag]);
            setDraftExcludeTags((current) => current.filter((tag) => tag !== normalizedTag));
            setIncludeInput("");
            setIncludeSuggestions([]);
        } else {
            setDraftExcludeTags((current) => current.includes(normalizedTag) ? current : [...current, normalizedTag]);
            setDraftIncludeTags((current) => current.filter((tag) => tag !== normalizedTag));
            setExcludeInput("");
            setExcludeSuggestions([]);
        }
    }

    function removeDraftTag(kind, tagToRemove) {
        if (kind === "include") {
            setDraftIncludeTags((current) => current.filter((tag) => tag !== tagToRemove));
            return;
        }

        setDraftExcludeTags((current) => current.filter((tag) => tag !== tagToRemove));
    }

    function applyTagFilters() {
        setAppliedIncludeTags(draftIncludeTags);
        setAppliedExcludeTags(draftExcludeTags);
        setAppliedBoughtOnly(draftBoughtOnly);
        setAppliedAuthorQuery(draftAuthorQuery);
        closeTagModal();
    }

    function clearTagFilters() {
        setDraftIncludeTags([]);
        setDraftExcludeTags([]);
        setAppliedIncludeTags([]);
        setAppliedExcludeTags([]);
        setDraftBoughtOnly(false);
        setAppliedBoughtOnly(false);
        setDraftAuthorQuery("");
        setAppliedAuthorQuery("");
        closeTagModal();
    }

    function handlePostTagClick(tag) {
        const normalizedTag = normalizeTag(tag);
        setAppliedIncludeTags(normalizedTag ? [normalizedTag] : []);
        setAppliedExcludeTags([]);
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">Following feed</h1>
                </div>

                <div className="page-actions">
                    <Link className="btn btn--primary" to="/create">
                        Create post
                    </Link>
                    <button className="btn btn--secondary" onClick={refreshAll} type="button">
                        Refresh
                    </button>
                    <button className="btn btn--secondary" onClick={openTagModal} type="button">
                        Search tags
                    </button>
                </div>
            </div>

            {location.state?.success && <div className="muted-box">{location.state.success}</div>}

            {loading && <div className="muted-box">Loading posts...</div>}
            {error && <div className="muted-box">{error}</div>}
            {!loading && !error && followedPosts.length === 0 && (
                <div className="muted-box">
                    Your following feed is empty. Follow a few authors or browse the latest posts below.
                </div>
            )}

            <div className="post-list">
                {followedPosts.map((post) => (
                    <PostCard
                        key={`followed-${post.id}`}
                        post={post}
                        onTagClick={handlePostTagClick}
                        compact
                    />
                ))}
            </div>

            <section className="section-stack">
                <div className="section-heading">
                    <h2 className="page-title page-title--section">Latest posts</h2>
                </div>

                {(appliedIncludeTags.length > 0 || appliedExcludeTags.length > 0 || appliedBoughtOnly) && (
                    <div className="tag-filter-summary">
                        {appliedIncludeTags.map((tag) => (
                            <span key={`include-${tag}`} className="tag-filter-pill">
                                Include #{tag}
                            </span>
                        ))}
                        {appliedExcludeTags.map((tag) => (
                            <span key={`exclude-${tag}`} className="tag-filter-pill tag-filter-pill--muted">
                                Exclude #{tag}
                            </span>
                        ))}
                        {appliedBoughtOnly && (
                            <span className="tag-filter-pill">Bought only</span>
                        )}
                        {appliedAuthorQuery && (
                            <span className="tag-filter-pill">Author: {appliedAuthorQuery}</span>
                        )}
                    </div>
                )}

                {discoverLoading && <div className="muted-box">Loading latest posts...</div>}
                {discoverError && <div className="muted-box">{discoverError}</div>}
                {!discoverLoading && !discoverError && visibleDiscoverPosts.length === 0 && (
                    <div className="muted-box">No posts match the current tag filters.</div>
                )}

                <div className="post-list">
                    {visibleDiscoverPosts.map((post) => (
                        <PostCard
                            key={`discover-${post.id}`}
                            post={post}
                            onTagClick={handlePostTagClick}
                            compact
                        />
                    ))}
                </div>
            </section>

            {isTagModalOpen && (
                <div className="feed-modal-backdrop" onClick={closeTagModal} role="presentation">
                    <div className="feed-modal card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="card__body feed-modal__body">
                            <div className="feed-modal__header">
                                <div>
                                    <h2 className="page-title page-title--section">Search by tags</h2>
                                    <p className="page-subtitle">Filter the latest posts by included and excluded tags.</p>
                                </div>
                            </div>

                            <TagAutocompleteField
                                label="Choose tags"
                                selectedTags={draftIncludeTags}
                                inputValue={includeInput}
                                suggestions={includeSuggestions}
                                placeholder="Start typing a tag"
                                onInputChange={handleIncludeInputChange}
                                onSelectTag={(tag) => addDraftTag("include", tag)}
                                onRemoveTag={(tag) => removeDraftTag("include", tag)}
                            />

                            <TagAutocompleteField
                                label="Exclude tags"
                                selectedTags={draftExcludeTags}
                                inputValue={excludeInput}
                                suggestions={excludeSuggestions}
                                placeholder="Start typing a tag"
                                onInputChange={handleExcludeInputChange}
                                onSelectTag={(tag) => addDraftTag("exclude", tag)}
                                onRemoveTag={(tag) => removeDraftTag("exclude", tag)}
                            />

                            {/*
                            Ready-to-enable author search.
                            Backend support is already wired through the `author` query param.
                            Uncomment this block to expose a single-value author filter in the modal.
                            <label className="field">
                                <span className="field__label">Author</span>
                                <input
                                    className="field__input"
                                    value={draftAuthorQuery}
                                    onChange={(event) => setDraftAuthorQuery(event.target.value)}
                                    placeholder="Username or display name"
                                />
                            </label>
                            */}

                            <label className="checkbox-field" htmlFor="bought-only-filter">
                                <input
                                    id="bought-only-filter"
                                    type="checkbox"
                                    checked={draftBoughtOnly}
                                    onChange={(event) => setDraftBoughtOnly(event.target.checked)}
                                />
                                <span>Show only bought paid posts</span>
                            </label>

                            <div className="form-actions">
                                <button className="btn btn--primary" type="button" onClick={applyTagFilters}>
                                    Apply filters
                                </button>
                                <button className="btn btn--secondary" type="button" onClick={clearTagFilters}>
                                    Clear
                                </button>
                                <button className="btn btn--secondary" type="button" onClick={closeTagModal}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FeedPage;
