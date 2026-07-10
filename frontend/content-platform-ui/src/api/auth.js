/*
Auth API
- login
- register
*/

import client from "./client";
import { unwrapApiResponse } from "./response";

export async function login(data) {
    const res = await client.post("/auth/login", data);
    return unwrapApiResponse(res);
}

export async function register(data) {
    const res = await client.post("/auth/register", data);
    return unwrapApiResponse(res);
}
