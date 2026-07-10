import client from "./client";
import { unwrapApiResponse } from "./response";

export async function followUser(userId) {
    const res = await client.post(`/follow/${userId}`);
    return unwrapApiResponse(res);
}

export async function unfollowUser(userId) {
    const res = await client.delete(`/follow/${userId}`);
    return unwrapApiResponse(res);
}
