import client, { API_ORIGIN } from "./client";
import { unwrapApiResponse } from "./response";

export async function getChats() {
    const res = await client.get("/messages/chats");
    return unwrapApiResponse(res);
}

export async function getConversation(userId) {
    const res = await client.get(`/messages/${userId}`);
    return unwrapApiResponse(res);
}

export async function sendMessage(userId, body) {
    const res = await client.post(`/messages/${userId}`, { body });
    return unwrapApiResponse(res);
}

export async function sendMediaMessage(userId, data) {
    const res = await client.post(`/messages/${userId}/media`, data);
    return unwrapApiResponse(res);
}

export async function waitForMessageUpdates(after = 0, signal) {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_ORIGIN}/api/v1/messages/stream?after=${after}`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal
    });

    const payload = await response.json();

    if (!response.ok || payload?.error) {
        throw new Error(payload?.error || "Failed to stream messages");
    }

    return Array.isArray(payload?.data?.messages) ? payload.data.messages : [];
}
