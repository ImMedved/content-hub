/*
Post service
*/
const postRepo = require("../repositories/postRepository");
const followRepo = require("../repositories/followRepository");
const purchaseRepo = require("../repositories/purchaseRepository");
const walletRepo = require("../repositories/walletRepository");
const feedService = require("./feedService");
const tagCacheService = require("./tagCacheService");
const { saveDataUrl } = require("../utils/mediaStorage");

const POST_TITLE_LIMIT = 120;

function normalizeContentItems(content = []) {
    return content
        .map((item) => {
            const type = String(item?.type || "").trim().toLowerCase();
            const value = item?.value;
            if (!type || !value) {
                return null;
            }
            if (type === "image" && typeof value === "string") {
                return {
                    type,
                    value: saveDataUrl(value, "post")
                };
            }
            return { type, value };
        })
        .filter(Boolean);
}
function getPreviewUrl(content = []) {
    const imageItem = content.find((item) => item.type === "image");
    return imageItem ? imageItem.value : null;
}

function normalizeAccess(access) {
    const type = String(access?.type || "free").trim().toLowerCase() === "paid" ? "paid" : "free";
    const rawPrice = Number(access?.price || 0);
    const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;

    return {
        type,
        price: type === "paid" ? price : 0
    };
}

function normalizeTags(tags = []) {
    return Array.isArray(tags)
        ? tags.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)
        : [];
}

function validateTitle(title) {
    if (!title) {
        throw new Error("Post title is required");
    }

    if (title.length > POST_TITLE_LIMIT) {
        throw new Error("Post title is too long");
    }
}

async function hydratePosts(posts, viewerId) {
    if (!Array.isArray(posts) || posts.length === 0) {
        return [];
    }
    const postIds = posts.map((post) => Number(post.id));
    const accessMap = await postRepo.getPostAccessMap(postIds);
    const contentMap = await postRepo.getPostContentMap(postIds);
    const tagMap = await postRepo.getPostTagMap(postIds);
    const accessibleIds = new Set(await purchaseRepo.getAccessiblePostIds(viewerId, postIds));
    return posts.map((post) => {
        const access = accessMap.get(Number(post.id)) || {
            access_type: "free",
            price: 0
        };
        const content = contentMap.get(Number(post.id)) || [];
        const canViewContent =
            access.access_type !== "paid" ||
            Number(post.author_id) === Number(viewerId) ||
            accessibleIds.has(Number(post.id));
        return {
            ...post,
            content: canViewContent ? content : [],
            tags: tagMap.get(Number(post.id)) || [],
            access_type: access.access_type,
            price: Number(access.price || 0),
            can_view_content: canViewContent,
            is_locked: !canViewContent
        };
    });
}
async function invalidateAuthorFeeds(userId) {
    const followers = await followRepo.getFollowers(userId);
    for (const followerId of followers) {
        await feedService.invalidateFeed(followerId);
    }
    await feedService.invalidateFeed(userId);
}
async function createPost(userId, data) {
    const title = String(data?.title || "").trim();
    const description = String(data?.description || "").trim();
    const content = normalizeContentItems(Array.isArray(data?.content) ? data.content : []);
    const previewUrl = getPreviewUrl(content);
    const access = normalizeAccess(data?.access);
    const tags = normalizeTags(data?.tags);

    validateTitle(title);

    const postId = await postRepo.createPost(userId, title, description, previewUrl);
    if (content.length > 0) {
        await postRepo.addContent(postId, content);
    }
    await postRepo.setAccess(postId, access);
    await postRepo.syncTags(postId, tags);
    await tagCacheService.addTags(tags);
    await invalidateAuthorFeeds(userId);
    return { postId };
}
async function getPost(id, viewerId = null) {
    const data = await postRepo.getPostById(id);
    if (!data.post) {
        return { post: null, content: [], access: null, tags: [] };
    }
    const [hydratedPost] = await hydratePosts([data.post], viewerId);
    return {
        post: hydratedPost,
        content: hydratedPost.content,
        access: {
            access_type: hydratedPost.access_type,
            price: hydratedPost.price
        },
        tags: hydratedPost.tags
    };
}
async function listPosts(filters = {}, viewerId = null) {
    const { limit, offset, authorId, author, tag, sort, accessType, includeTags, excludeTags } = filters;
    const normalizedIncludeTags = Array.isArray(includeTags) ? includeTags : [];
    const normalizedExcludeTags = Array.isArray(excludeTags) ? excludeTags : [];
    const posts = await postRepo.listPosts(
        limit || 20,
        offset || 0,
        authorId || null,
        author || null,
        tag || null,
        sort || "new",
        accessType || null,
        normalizedIncludeTags,
        normalizedExcludeTags
    );
    return hydratePosts(posts, viewerId);
}
async function listTags(query, limit = 8) {
    const cachedSuggestions = await tagCacheService.getSuggestions(query, limit);
    if (Array.isArray(cachedSuggestions)) {
        return cachedSuggestions;
    }
    return postRepo.listTags(query, limit);
}
async function purchasePost(userId, postId) {
    const details = await getPost(postId, userId);
    const post = details.post;
    if (!post) {
        throw new Error("Post not found");
    }
    if (Number(post.author_id) === Number(userId)) {
        throw new Error("You already own this post");
    }
    if (post.access_type !== "paid") {
        throw new Error("Post does not require purchase");
    }
    const result = await purchaseRepo.purchasePost(userId, {
        id: post.id,
        author_id: post.author_id,
        price: post.price
    });
    await feedService.invalidateFeed(userId);
    const wallet = await walletRepo.getWallet(userId);
    return {
        postId: post.id,
        alreadyOwned: result.alreadyOwned,
        walletBalance: Number(wallet?.balance || result.balance || 0),
        commissionAmount: Number(result.commissionAmount || 0),
        sellerIncome: Number(result.sellerIncome || 0)
    };
}
async function getReactionUsers(postId, viewerId) {
    const owner = await postRepo.getPostOwner(postId);
    if (!owner) {
        throw new Error("Post not found");
    }
    if (Number(owner.author_id) !== Number(viewerId)) {
        throw new Error("Only the author can view liked users");
    }
    return postRepo.getReactionUsers(postId);
}

async function updatePost(userId, postId, data) {
    const title = String(data?.title || "").trim();
    const description = String(data?.description || "").trim();
    const content = normalizeContentItems(Array.isArray(data?.content) ? data.content : []);
    const previewUrl = getPreviewUrl(content);
    const access = normalizeAccess(data?.access);
    const tags = normalizeTags(data?.tags);

    validateTitle(title);

    const updatedRows = await postRepo.updatePost(postId, userId, title, description, previewUrl);

    if (!updatedRows) {
        throw new Error("Post not found or you cannot edit it");
    }

    await postRepo.replaceContent(postId, content);
    await postRepo.updateAccess(postId, access);
    await postRepo.syncTags(postId, tags);
    await tagCacheService.addTags(tags);
    await invalidateAuthorFeeds(userId);

    return { postId: Number(postId), updated: true };
}

async function deletePost(userId, postId) {
    const deletedRows = await postRepo.deletePost(postId, userId);

    if (!deletedRows) {
        throw new Error("Post not found or you cannot delete it");
    }

    await invalidateAuthorFeeds(userId);
    return true;
}

async function pinPost(userId, postId) {
    const owner = await postRepo.getPostOwner(postId);

    if (!owner || Number(owner.author_id) !== Number(userId)) {
        throw new Error("Post not found or you cannot pin it");
    }

    await postRepo.clearPinnedForAuthor(userId, postId);
    await postRepo.pinPost(postId, userId);
    await invalidateAuthorFeeds(userId);

    return { postId: Number(postId), pinned: true };
}

module.exports = {
    createPost,
    getPost,
    listPosts,
    listTags,
    purchasePost,
    getReactionUsers,
    hydratePosts,
    updatePost,
    deletePost,
    pinPost
};
