import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getFeed } from "../api/feed";
import { getPosts, getTagSuggestions } from "../api/post";
import { getApiErrorMessage } from "../api/response";
import EmptyState from "../components/EmptyState";
import FeedFiltersModal from "../components/FeedFiltersModal";
import PostCard from "../components/PostCard";
import ScrollToTopButton from "../components/ScrollToTopButton";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/useToast";

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

function sortFollowingPosts(posts, sort) {
    const items = [...posts];

    if (sort === "expensive") {
        return items.sort((left, right) => Number(right.price || 0) - Number(left.price || 0));
    }

    if (sort === "new") {
        return items.sort(
            (left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
        );
    }

    return items;
}

function matchesLocalFilters(post, includeTags, excludeTags, authorQuery, accessType, boughtOnly, currentUserId) {
    const tags = Array.isArray(post.tags) ? post.tags : [];
    const normalizedAuthorQuery = String(authorQuery || "").trim().toLowerCase();
    const authorText = `${post.author_username || ""} ${post.authorName || ""}`.toLowerCase();

    if (includeTags.some((tag) => !tags.includes(tag))) {
        return false;
    }

    if (excludeTags.some((tag) => tags.includes(tag))) {
        return false;
    }

    if (normalizedAuthorQuery && !authorText.includes(normalizedAuthorQuery)) {
        return false;
    }

    if (accessType && post.access_type !== accessType) {
        return false;
    }

    if (boughtOnly && !isBoughtPost(post, currentUserId)) {
        return false;
    }

    return true;
}

function FeedPage() {
    const location = useLocation();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [mode, setMode] = useState("following");
    const [sort, setSort] = useState("new");
    const [accessType, setAccessType] = useState("");
    const [limit, setLimit] = useState(10);
    const [followedPosts, setFollowedPosts] = useState([]);
    const [allPosts, setAllPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [allLoading, setAllLoading] = useState(true);
    const [error, setError] = useState("");
    const [allError, setAllError] = useState("");
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
    const currentUserId = user?.id ?? null;

    const loadFeed = useCallback(async () => {
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
    }, []);

    const loadAllPosts = useCallback(async () => {
        setAllLoading(true);
        setAllError("");

        try {
            const params = {
                limit,
                sort
            };

            if (appliedIncludeTags.length > 0) {
                params.includeTags = appliedIncludeTags.join(",");
            }

            if (appliedExcludeTags.length > 0) {
                params.excludeTags = appliedExcludeTags.join(",");
            }

            if (String(appliedAuthorQuery || "").trim()) {
                params.author = String(appliedAuthorQuery).trim();
            }

            if (accessType) {
                params.accessType = accessType;
            }

            const data = await getPosts(params);
            setAllPosts(Array.isArray(data) ? data : []);
        } catch (err) {
            setAllError(getApiErrorMessage(err));
            setAllPosts([]);
        } finally {
            setAllLoading(false);
        }
    }, [limit, sort, appliedIncludeTags, appliedExcludeTags, appliedAuthorQuery, accessType]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadFeed();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [loadFeed]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadAllPosts();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [loadAllPosts]);

    useEffect(() => {
        if (typeof location.state?.restoreScrollY === "number") {
            window.scrollTo({ top: location.state.restoreScrollY, behavior: "auto" });
        }
    }, [location.state]);

    useEffect(() => {
        if (!isTagModalOpen) {
            return;
        }

        const normalizedValue = normalizeTag(includeInput);

        if (!normalizedValue) {
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                const tags = await getTagSuggestions(normalizedValue);
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

        const normalizedValue = normalizeTag(excludeInput);

        if (!normalizedValue) {
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                const tags = await getTagSuggestions(normalizedValue);
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

    async function refreshAll() {
        await Promise.all([loadFeed(), loadAllPosts()]);
        showToast("Feed refreshed", "success");
    }

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
            return;
        }

        setDraftExcludeTags((current) => current.includes(normalizedTag) ? current : [...current, normalizedTag]);
        setDraftIncludeTags((current) => current.filter((tag) => tag !== normalizedTag));
        setExcludeInput("");
        setExcludeSuggestions([]);
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

    function handleApplyTag(tag) {
        const normalizedTag = normalizeTag(tag);
        setMode("all");
        setAppliedIncludeTags(normalizedTag ? [normalizedTag] : []);
        setAppliedExcludeTags([]);
    }

    const visibleFollowingPosts = sortFollowingPosts(
        followedPosts.filter((post) =>
            matchesLocalFilters(
                post,
                appliedIncludeTags,
                appliedExcludeTags,
                appliedAuthorQuery,
                accessType,
                appliedBoughtOnly,
                currentUserId
            )
        ),
        sort
    );

    const visibleAllPosts = allPosts.filter((post) =>
        matchesLocalFilters(
            post,
            appliedIncludeTags,
            appliedExcludeTags,
            appliedAuthorQuery,
            accessType,
            appliedBoughtOnly,
            currentUserId
        )
    );

    const visiblePosts = mode === "following" ? visibleFollowingPosts : visibleAllPosts;
    const sectionTitle = mode === "following" ? "Following feed" : "All posts";

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">{sectionTitle}</h1>
                </div>

                <div className="page-actions">
                    <Link className="btn btn--primary" to="/create">
                        Create post
                    </Link>
                    <button className="btn btn--secondary" onClick={refreshAll} type="button">
                        Refresh
                    </button>
                    <button className="btn btn--secondary" onClick={openTagModal} type="button">
                        Filters
                    </button>
                </div>
            </div>

            {location.state?.success && <EmptyState>{location.state.success}</EmptyState>}

            <div className="feed-toolbar card">
                <div className="card__body feed-toolbar__body">
                    <label className="field">
                        <span className="field__label">Mode</span>
                        <select className="field__select" value={mode} onChange={(event) => setMode(event.target.value)}>
                            <option value="following">Following</option>
                            <option value="all">All posts</option>
                        </select>
                    </label>

                    <label className="field">
                        <span className="field__label">Sort</span>
                        <select className="field__select" value={sort} onChange={(event) => setSort(event.target.value)}>
                            <option value="new">New</option>
                            <option value="popular">Popular</option>
                            <option value="expensive">Expensive</option>
                        </select>
                    </label>

                    <label className="field">
                        <span className="field__label">Access</span>
                        <select
                            className="field__select"
                            value={accessType}
                            onChange={(event) => setAccessType(event.target.value)}
                        >
                            <option value="">All</option>
                            <option value="free">Free</option>
                            <option value="paid">Paid</option>
                        </select>
                    </label>
                </div>
            </div>

            {(appliedIncludeTags.length > 0 || appliedExcludeTags.length > 0 || appliedBoughtOnly || appliedAuthorQuery) && (
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
                    {appliedBoughtOnly && <span className="tag-filter-pill">Bought only</span>}
                    {appliedAuthorQuery && <span className="tag-filter-pill">Author: {appliedAuthorQuery}</span>}
                </div>
            )}

            {mode === "following" && loading && <EmptyState>Loading following feed...</EmptyState>}
            {mode === "following" && error && <EmptyState>{error}</EmptyState>}
            {mode === "all" && allLoading && <EmptyState>Loading posts...</EmptyState>}
            {mode === "all" && allError && <EmptyState>{allError}</EmptyState>}

            {!loading && !error && !allLoading && !allError && visiblePosts.length === 0 && (
                <EmptyState>
                    {mode === "following"
                        ? "Your following feed is empty. Try following users, creating a post, or switching to all posts."
                        : "No posts match the current filters. Try clearing filters or loading more posts."}
                </EmptyState>
            )}

            <div className="post-list">
                {visiblePosts.map((post) => (
                    <PostCard
                        key={`${mode}-${post.id}`}
                        post={post}
                        onTagApply={handleApplyTag}
                        compact={mode === "all"}
                    />
                ))}
            </div>

            {mode === "all" && !allLoading && (
                <div className="form-actions">
                    <button
                        className="btn btn--secondary"
                        type="button"
                        onClick={() => setLimit((current) => current + 10)}
                    >
                        Load more
                    </button>
                </div>
            )}

            {isTagModalOpen && (
                <FeedFiltersModal
                    draftIncludeTags={draftIncludeTags}
                    draftExcludeTags={draftExcludeTags}
                    draftBoughtOnly={draftBoughtOnly}
                    draftAuthorQuery={draftAuthorQuery}
                    includeInput={includeInput}
                    excludeInput={excludeInput}
                    includeSuggestions={includeSuggestions}
                    excludeSuggestions={excludeSuggestions}
                    onIncludeInputChange={handleIncludeInputChange}
                    onExcludeInputChange={handleExcludeInputChange}
                    onSelectIncludeTag={(tag) => addDraftTag("include", tag)}
                    onSelectExcludeTag={(tag) => addDraftTag("exclude", tag)}
                    onRemoveIncludeTag={(tag) => removeDraftTag("include", tag)}
                    onRemoveExcludeTag={(tag) => removeDraftTag("exclude", tag)}
                    onAuthorQueryChange={setDraftAuthorQuery}
                    onBoughtOnlyChange={setDraftBoughtOnly}
                    onApply={applyTagFilters}
                    onClear={clearTagFilters}
                    onClose={closeTagModal}
                />
            )}

            <ScrollToTopButton />
        </div>
    );
}

export default FeedPage;
