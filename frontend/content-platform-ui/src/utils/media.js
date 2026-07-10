import { API_ORIGIN } from "../api/client";

const EMPTY_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%23dfe6f1'/%3E%3Ccircle cx='48' cy='36' r='18' fill='%23b7c3d4'/%3E%3Cpath d='M18 84c7-18 21-27 30-27s23 9 30 27' fill='%23b7c3d4'/%3E%3C/svg%3E";

export function resolveMediaUrl(value) {
    if (!value) {
        return EMPTY_AVATAR;
    }

    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
        return value;
    }

    if (value.startsWith("/")) {
        return `${API_ORIGIN}${value}`;
    }

    return value;
}
