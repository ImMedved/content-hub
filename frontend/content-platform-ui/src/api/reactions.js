/*
Reaction API
*/

import client from "./client";
import { unwrapApiResponse } from "./response";

export async function addReaction(postId, type = "like") {
    const res = await client.post("/reactions", { postId, type });
    return unwrapApiResponse(res);
}

export async function getReactions(postId) {
    const res = await client.get(`/reactions/${postId}`);
    return unwrapApiResponse(res);
}

export async function removeReaction(postId) {
    const res = await client.delete(`/reactions/${postId}`);
    return unwrapApiResponse(res);
}

export async function getReactionUsers(postId) {
    const res = await client.get(`/posts/${postId}/reactions/users`);
    return unwrapApiResponse(res);
}
