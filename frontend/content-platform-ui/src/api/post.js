/*
Post API
*/

import client from "./client";
import { unwrapApiResponse } from "./response";

export async function createPost(data) {
    const res = await client.post("/posts", data);
    return unwrapApiResponse(res);
}

export async function updatePost(id, data) {
    const res = await client.put(`/posts/${id}`, data);
    return unwrapApiResponse(res);
}

export async function deletePost(id) {
    const res = await client.delete(`/posts/${id}`);
    return unwrapApiResponse(res);
}

export async function pinPost(id) {
    const res = await client.post(`/posts/${id}/pin`);
    return unwrapApiResponse(res);
}

export async function getPosts(params = {}) {
    const res = await client.get("/posts", { params });
    return unwrapApiResponse(res);
}

export async function createImages(data) {
    const res = await client.post("/posts/images", data);
    return unwrapApiResponse(res);
}

export async function getImages(params = {}) {
    const res = await client.get("/posts/images", { params });
    return unwrapApiResponse(res);
}

export async function getTagSuggestions(query, limit = 8) {
    const res = await client.get("/posts/tags", {
        params: {
            query,
            limit
        }
    });
    return unwrapApiResponse(res);
}

export async function getPost(id) {
    const res = await client.get("/posts/" + id);
    return unwrapApiResponse(res);
}

export async function purchasePost(id) {
    const res = await client.post("/posts/" + id + "/purchase");
    return unwrapApiResponse(res);
}
