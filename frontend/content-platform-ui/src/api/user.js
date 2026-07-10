/*
User API
*/

import client from "./client";
import { getPosts } from "./post";
import { unwrapApiResponse } from "./response";

export async function getMe() {
    const res = await client.get("/users/me");
    return unwrapApiResponse(res);
}

export async function getUser(id) {
    const res = await client.get(`/users/${id}`);
    return unwrapApiResponse(res);
}

export async function getMyFollowing() {
    const res = await client.get("/users/me/following");
    return unwrapApiResponse(res);
}

export async function getMyFollowers() {
    const res = await client.get("/users/me/followers");
    return unwrapApiResponse(res);
}

export async function getUserFollowing(id) {
    const res = await client.get(`/users/${id}/following`);
    return unwrapApiResponse(res);
}

export async function getUserFollowers(id) {
    const res = await client.get(`/users/${id}/followers`);
    return unwrapApiResponse(res);
}

export async function updateMe(data) {
    const res = await client.put("/users/me", data);
    return unwrapApiResponse(res);
}

export async function getMyProfile() {
    const me = await getMe();
    const { posts = [], ...user } = me || {};

    return {
        user: me ? user : null,
        posts: Array.isArray(posts) ? posts : []
    };
}

export async function getUserProfile(id) {
    const profile = await getUser(id);

    if (!profile) {
        return null;
    }

    const { posts: inlinePosts = [], ...user } = profile;

    const posts = Array.isArray(inlinePosts)
        ? inlinePosts
        : await getPosts({ authorId: id });

    return {
        user,
        posts: Array.isArray(posts) ? posts : []
    };
}
