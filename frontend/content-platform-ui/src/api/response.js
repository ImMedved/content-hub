export function unwrapApiResponse(response) {
    const payload = response?.data;

    if (!payload || typeof payload !== "object") {
        throw new Error("Invalid API response");
    }

    if (payload.error) {
        throw new Error(payload.error);
    }

    return payload.data;
}

export function getApiErrorMessage(error) {
    const responseError = error?.response?.data?.error;

    if (typeof responseError === "string" && responseError.trim()) {
        return responseError;
    }

    if (typeof error?.message === "string" && error.message.trim()) {
        return error.message;
    }

    return "Something went wrong. Please try again.";
}
