import client from "./client";
import { unwrapApiResponse } from "./response";

export async function createPlaybackSession(mediaId) {
    const res = await client.post(`/media/${mediaId}/playback-session`, null, {
        withCredentials: true
    });

    return unwrapApiResponse(res);
}
