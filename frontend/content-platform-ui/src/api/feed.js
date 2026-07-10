import client from "./client";
import { unwrapApiResponse } from "./response";

export async function getFeed() {
    const res = await client.get("/feed");
    return unwrapApiResponse(res);
}
