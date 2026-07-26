/*
Post service
*/
const postRepo = require("../repositories/postRepository");
const followRepo = require("../repositories/followRepository");
const purchaseRepo = require("../repositories/purchaseRepository");
const walletRepo = require("../repositories/walletRepository");
const feedService = require("./feedService");
const tagCacheService = require("./tagCacheService");
const imageQueueService = require("./imageQueueService");
const minioStorageService = require("./minioStorageService");
const videoProcessingService = require("./videoProcessingService");
const cache = require("./redisCacheService");
const { parseDataUrl, saveDataUrl } = require("../utils/mediaStorage");

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
    const values = Array.isArray(tags) ? tags : String(tags || "").split(",");

    return values.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean);
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
    const imageAssetMap = await postRepo.getImageAssetMap(postIds);
    const tagMap = await postRepo.getPostTagMap(postIds);
    const reactionCountMap = await getCachedCountMap(postIds, cache.reactionCountKey, () => postRepo.getReactionCountMap(postIds));
    const commentCountMap = await getCachedCountMap(postIds, cache.commentCountKey, () => postRepo.getCommentCountMap(postIds));
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
            image: sanitizeImageAsset(imageAssetMap.get(Number(post.id))),
            tags: tagMap.get(Number(post.id)) || [],
            reaction_count: reactionCountMap.get(Number(post.id)) ?? Number(post.reaction_count || 0),
            comment_count: commentCountMap.get(Number(post.id)) ?? 0,
            access_type: access.access_type,
            price: Number(access.price || 0),
            can_view_content: canViewContent,
            is_locked: !canViewContent
        };
    });
}

function sanitizeImageAsset(asset) {
    if (!asset) {
        return null;
    }

    return {
        id: asset.id,
        post_id: asset.post_id,
        owner_id: asset.owner_id,
        compressed_url: asset.compressed_url,
        thumbnail_url: asset.thumbnail_url,
        feed_thumbnail_url: asset.feed_thumbnail_url,
        processing_status: asset.processing_status,
        analysis_status: asset.analysis_status,
        analysis_payload: asset.analysis_payload,
        ocr_text: asset.ocr_text,
        caption: asset.caption,
        created_at: asset.created_at,
        updated_at: asset.updated_at
    };
}

async function getCachedCountMap(postIds, keyBuilder, loader) {
    const result = new Map();
    const missingIds = [];

    for (const postId of postIds) {
        const cached = await cache.readJson(keyBuilder(postId));
        if (typeof cached === "number") {
            result.set(Number(postId), cached);
        } else {
            missingIds.push(postId);
        }
    }

    if (missingIds.length > 0) {
        const loaded = await loader();
        for (const postId of missingIds) {
            const value = Number(loaded.get(Number(postId)) || 0);
            result.set(Number(postId), value);
            await cache.writeJson(keyBuilder(postId), value, 300);
        }
    }

    return result;
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
    const { limit, offset, authorId, author, tag, sort, accessType, includeTags, excludeTags, postKind, followedByUserId } = filters;
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
        normalizedExcludeTags,
        postKind || null,
        followedByUserId || null
    );
    return hydratePosts(posts, viewerId);
}

async function invalidateImageCaches(userId) {
    await cache.deleteKeys([cache.latestProfileImagesKey(userId)]);
    await invalidateAuthorFeeds(userId);
}

function normalizeImageUploadItem(item, index) {
    const parsed = parseDataUrl(item?.file || item?.dataUrl || item?.value);

    if (!parsed) {
        throw new Error("Image file payload is required");
    }

    if (!String(parsed.mimeType || "").startsWith("image/")) {
        throw new Error("Only image files can be uploaded here");
    }

    const title = String(item?.title || item?.name || `Image ${index + 1}`).trim().slice(0, POST_TITLE_LIMIT);

    return {
        title: title || `Image ${index + 1}`,
        description: String(item?.description || "").trim(),
        tags: normalizeTags(item?.tags),
        parsed,
        filename: String(item?.filename || item?.name || `image-${index + 1}.${parsed.extension}`)
    };
}

async function createImagePosts(userId, data) {
    const rawImages = Array.isArray(data?.images) ? data.images : [];

    if (rawImages.length === 0) {
        throw new Error("Select at least one image");
    }

    const created = [];

    for (let index = 0; index < rawImages.length; index += 1) {
        const item = normalizeImageUploadItem(rawImages[index], index);
        const originalKey = minioStorageService.buildObjectKey("originals", item.filename, item.parsed.extension);
        const originalObject = await minioStorageService.putObject({
            key: originalKey,
            buffer: item.parsed.buffer,
            contentType: item.parsed.mimeType
        });
        const postId = await postRepo.createImagePost(userId, {
            title: item.title,
            description: item.description || "",
            originalUrl: originalObject.url,
            compressedUrl: null,
            thumbnailUrl: null,
            feedThumbnailUrl: null,
            originalStorageKey: originalObject.key,
            compressedStorageKey: null,
            thumbnailStorageKey: null,
            feedThumbnailStorageKey: null,
            processingStatus: "queued",
            analysisStatus: "queued",
            analysisPayload: null,
            ocrText: null,
            caption: null
        });

        await postRepo.updateImagePostMedia(postId, {
            contentUrl: null,
            previewUrl: null
        });

        await postRepo.syncTags(postId, item.tags);
        await tagCacheService.addTags(item.tags);
        await imageQueueService.enqueueImageProcessing(postId);
        created.push({ postId, tags: item.tags, processingStatus: "queued", analysisStatus: "queued" });
    }

    await invalidateImageCaches(userId);
    return created;
}

function normalizeVideoUploadItem(data) {
    const parsed = parseDataUrl(data?.file || data?.dataUrl || data?.value);

    if (!parsed) {
        throw new Error("Video file payload is required");
    }

    if (!String(parsed.mimeType || "").startsWith("video/")) {
        throw new Error("Only video files can be uploaded here");
    }

    const title = String(data?.title || data?.name || "Video").trim().slice(0, POST_TITLE_LIMIT);

    return {
        title: title || "Video",
        description: String(data?.description || "").trim(),
        tags: normalizeTags(data?.tags),
        access: normalizeAccess(data?.access),
        parsed,
        filename: String(data?.filename || data?.name || `video.${parsed.extension}`)
    };
}

async function createVideoPost(userId, data) {
    const item = normalizeVideoUploadItem(data || {});
    console.log(`[video-upload] received userId=${userId} filename=${item.filename} bytes=${item.parsed.buffer.length} mime=${item.parsed.mimeType}`);
    const originalKey = minioStorageService.buildObjectKey("videos/originals", item.filename, item.parsed.extension);
    const originalObject = await minioStorageService.putObject({
        key: originalKey,
        buffer: item.parsed.buffer,
        contentType: item.parsed.mimeType
    });
    console.log(`[video-upload] stored original userId=${userId} key=${originalObject.key}`);
    const hlsStoragePrefix = `media/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const { postId, mediaId } = await postRepo.createVideoPost(userId, {
        title: item.title,
        description: item.description,
        originalUrl: originalObject.url,
        originalStorageKey: originalObject.key,
        hlsStoragePrefix,
        access: item.access
    });
    console.log(`[video-upload] created post/media postId=${postId} mediaId=${mediaId} hlsPrefix=${hlsStoragePrefix}`);

    await postRepo.syncTags(postId, item.tags);
    await tagCacheService.addTags(item.tags);
    await invalidateAuthorFeeds(userId);

    videoProcessingService.processVideoInBackground({
        mediaId,
        sourceKey: originalObject.key,
        hlsStoragePrefix
    });
    console.log(`[video-upload] queued background processing postId=${postId} mediaId=${mediaId}`);

    return {
        postId,
        mediaId,
        processingStatus: "queued"
    };
}

async function listImages(filters = {}, viewerId = null) {
    const wantsLatestProfileImages =
        filters.authorId &&
        !filters.followedByUserId &&
        Number(filters.offset || 0) === 0 &&
        Number(filters.limit || 40) <= 4;

    if (wantsLatestProfileImages) {
        const cached = await cache.readJson(cache.latestProfileImagesKey(filters.authorId));
        if (Array.isArray(cached)) {
            return cached;
        }
    }

    const rows = await postRepo.listImages({
        limit: filters.limit || 40,
        offset: filters.offset || 0,
        authorId: filters.authorId || null,
        followedByUserId: filters.followedByUserId || null
    });

    const hydrated = await hydratePosts(rows, viewerId);
    if (wantsLatestProfileImages) {
        await cache.writeJson(cache.latestProfileImagesKey(filters.authorId), hydrated, 120);
    }
    return hydrated;
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
    createImagePosts,
    createVideoPost,
    invalidateImageCaches,
    getPost,
    listPosts,
    listImages,
    listTags,
    purchasePost,
    getReactionUsers,
    hydratePosts,
    updatePost,
    deletePost,
    pinPost
};
