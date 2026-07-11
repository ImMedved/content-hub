/*
Comment API
*/

import client from "./client";
import { unwrapApiResponse } from "./response";

export async function createComment(data) {
    const res = await client.post("/comments", data);
    return unwrapApiResponse(res);
}

export async function getComments(postId) {
    const res = await client.get("/comments/post/" + postId);
    return unwrapApiResponse(res);
}

export async function updateComment(commentId, content) {
    const res = await client.put(`/comments/${commentId}`, { content });
    return unwrapApiResponse(res);
}

export async function deleteComment(commentId) {
    const res = await client.delete(`/comments/${commentId}`);
    return unwrapApiResponse(res);
}
