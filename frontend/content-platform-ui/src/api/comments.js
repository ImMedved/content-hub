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
