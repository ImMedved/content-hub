#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:5001/api/v1}"
SERVER_ORIGIN="${API_BASE_URL%/api/v1}"
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_PID=""
STARTED_SERVER=0

json_field() {
    node -e '
        const data = JSON.parse(process.argv[1]);
        const path = process.argv[2].split(".");
        let current = data;
        for (const key of path) current = current?.[key];
        if (typeof current === "undefined") process.exit(2);
        process.stdout.write(typeof current === "string" ? current : JSON.stringify(current));
    ' "$1" "$2"
}

api() {
    local method="$1"
    local path="$2"
    local body="${3:-}"
    local token="${4:-}"
    local response

    if [[ -n "$body" && -n "$token" ]]; then
        response="$(curl -sS -X "$method" "$API_BASE_URL$path" -H "Authorization: Bearer $token" -H "Content-Type: application/json" --data "$body")"
    elif [[ -n "$body" ]]; then
        response="$(curl -sS -X "$method" "$API_BASE_URL$path" -H "Content-Type: application/json" --data "$body")"
    elif [[ -n "$token" ]]; then
        response="$(curl -sS -X "$method" "$API_BASE_URL$path" -H "Authorization: Bearer $token")"
    else
        response="$(curl -sS -X "$method" "$API_BASE_URL$path")"
    fi

    node -e '
        const payload = JSON.parse(process.argv[1]);
        if (payload.error !== null && typeof payload.error !== "undefined") {
            console.error(payload.error);
            process.exit(1);
        }
        process.stdout.write(JSON.stringify(payload.data));
    ' "$response"
}

wait_for_server() {
    for _ in {1..30}; do
        if curl -fsS "$SERVER_ORIGIN/health" >/dev/null 2>&1; then
            return
        fi
        sleep 1
    done
    echo "Backend server did not start in time." >&2
    exit 1
}

cleanup() {
    if [[ "$STARTED_SERVER" -eq 1 && -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
        kill "$SERVER_PID" || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

if ! curl -fsS "$SERVER_ORIGIN/health" >/dev/null 2>&1; then
    (
        cd "$BACKEND_DIR"
        if [[ "${DB_ONLY:-0}" == "1" ]]; then
            env NODE_ENV=test DB_ONLY=1 node -r dotenv/config src/server.js dotenv_config_path=.env.test
        else
            env NODE_ENV=test node -r dotenv/config src/server.js dotenv_config_path=.env.test
        fi
    ) >/tmp/content-platform-curl-test.log 2>&1 &
    SERVER_PID="$!"
    STARTED_SERVER=1
    wait_for_server
fi

SUFFIX="$(date +%Y%m%d%H%M%S)"

AUTHOR_REGISTER="$(api POST /auth/register "{\"username\":\"curl_author_$SUFFIX\",\"email\":\"curl_author_$SUFFIX@test.com\",\"password\":\"123456\"}")"
READER_REGISTER="$(api POST /auth/register "{\"username\":\"curl_reader_$SUFFIX\",\"email\":\"curl_reader_$SUFFIX@test.com\",\"password\":\"123456\"}")"

AUTHOR_LOGIN="$(api POST /auth/login "{\"email\":\"curl_author_$SUFFIX@test.com\",\"password\":\"123456\"}")"
READER_LOGIN="$(api POST /auth/login "{\"email\":\"curl_reader_$SUFFIX@test.com\",\"password\":\"123456\"}")"

AUTHOR_TOKEN="$(json_field "$AUTHOR_LOGIN" token)"
READER_TOKEN="$(json_field "$READER_LOGIN" token)"

AUTHOR_ME="$(api GET /users/me "" "$AUTHOR_TOKEN")"
READER_ME="$(api GET /users/me "" "$READER_TOKEN")"
AUTHOR_ID="$(json_field "$AUTHOR_ME" id)"
READER_ID="$(json_field "$READER_ME" id)"

[[ "$(json_field "$AUTHOR_ME" wallet_balance)" == "100" ]] || { echo "Invalid author starter wallet" >&2; exit 1; }
[[ "$(json_field "$READER_ME" wallet_balance)" == "100" ]] || { echo "Invalid reader starter wallet" >&2; exit 1; }

UPDATED_PROFILE="$(api PUT /users/me "{\"display_name\":\"Curl Author\",\"bio\":\"updated via curl\",\"status\":\"creator\",\"avatar_url\":\"https://example.com/avatar.png\"}" "$AUTHOR_TOKEN")"
[[ "$(json_field "$UPDATED_PROFILE" display_name)" == "Curl Author" ]] || { echo "Profile update failed" >&2; exit 1; }

api POST "/follow/$AUTHOR_ID" "" "$READER_TOKEN" >/dev/null

POST_DATA="$(api POST /posts "{\"title\":\"curl post $SUFFIX\",\"description\":\"created from curl smoke test\",\"content\":[{\"type\":\"text\",\"value\":\"hello from curl\"}],\"tags\":[\"curl\",\"smoke\"],\"access\":{\"type\":\"paid\",\"price\":15}}" "$AUTHOR_TOKEN")"
POST_ID="$(json_field "$POST_DATA" postId)"

DISCOVER="$(api GET /posts?tag=curl "" "$READER_TOKEN")"
node -e 'const posts = JSON.parse(process.argv[1]); const id = Number(process.argv[2]); if (!posts.some((post) => Number(post.id) === id)) process.exit(1);' "$DISCOVER" "$POST_ID" || { echo "Tag search failed" >&2; exit 1; }

FEED="$(api GET /feed "" "$READER_TOKEN")"
node -e 'const posts = JSON.parse(process.argv[1]); const id = Number(process.argv[2]); const item = posts.find((post) => Number(post.id) === id); if (!item || !item.is_locked) process.exit(1);' "$FEED" "$POST_ID" || { echo "Feed lock check failed" >&2; exit 1; }

LOCKED_POST="$(api GET "/posts/$POST_ID" "" "$READER_TOKEN")"
[[ "$(json_field "$LOCKED_POST" post.is_locked)" == "true" ]] || { echo "Paid post should be locked" >&2; exit 1; }

PURCHASE="$(api POST "/posts/$POST_ID/purchase" "" "$READER_TOKEN")"
[[ "$(json_field "$PURCHASE" walletBalance)" == "85" ]] || { echo "Wallet balance after purchase is invalid" >&2; exit 1; }

UNLOCKED_POST="$(api GET "/posts/$POST_ID" "" "$READER_TOKEN")"
[[ "$(json_field "$UNLOCKED_POST" post.is_locked)" == "false" ]] || { echo "Paid post should be unlocked" >&2; exit 1; }

COMMENT_DATA="$(api POST /comments "{\"postId\":$POST_ID,\"content\":\"curl comment\"}" "$READER_TOKEN")"
COMMENT_ID="$(json_field "$COMMENT_DATA" commentId)"
COMMENTS="$(api GET "/comments/post/$POST_ID")"
node -e 'const comments = JSON.parse(process.argv[1]); const id = Number(process.argv[2]); if (!comments.some((comment) => Number(comment.id) === id)) process.exit(1);' "$COMMENTS" "$COMMENT_ID" || { echo "Comment list failed" >&2; exit 1; }

api POST /reactions "{\"postId\":$POST_ID,\"type\":\"like\"}" "$READER_TOKEN" >/dev/null
REACTIONS="$(api GET "/reactions/$POST_ID")"
node -e 'const rows = JSON.parse(process.argv[1]); if (!rows.some((row) => row.type === "like")) process.exit(1);' "$REACTIONS" || { echo "Reaction list failed" >&2; exit 1; }

LIKERS="$(api GET "/posts/$POST_ID/reactions/users" "" "$AUTHOR_TOKEN")"
node -e 'const rows = JSON.parse(process.argv[1]); const id = Number(process.argv[2]); if (!rows.some((row) => Number(row.id) === id)) process.exit(1);' "$LIKERS" "$READER_ID" || { echo "Likers endpoint failed" >&2; exit 1; }

api POST "/follow/$READER_ID" "" "$AUTHOR_TOKEN" >/dev/null

STREAM_FILE="$(mktemp)"
curl -sS -H "Authorization: Bearer $READER_TOKEN" "$API_BASE_URL/messages/stream?after=0" > "$STREAM_FILE" &
STREAM_PID="$!"
sleep 1

DIRECT_MESSAGE="$(api POST "/messages/$READER_ID" "{\"body\":\"hello from curl chat\"}" "$AUTHOR_TOKEN")"
DIRECT_MESSAGE_ID="$(json_field "$DIRECT_MESSAGE" id)"
wait "$STREAM_PID"

STREAM_JSON="$(cat "$STREAM_FILE")"
rm -f "$STREAM_FILE"
node -e 'const payload = JSON.parse(process.argv[1]); const id = Number(process.argv[2]); if (!payload.data.messages.some((item) => Number(item.id) === id)) process.exit(1);' "$STREAM_JSON" "$DIRECT_MESSAGE_ID" || { echo "Message stream failed" >&2; exit 1; }

CHATS="$(api GET /messages/chats "" "$READER_TOKEN")"
node -e 'const chats = JSON.parse(process.argv[1]); const id = Number(process.argv[2]); if (!chats.some((chat) => Number(chat.peer.id) === id)) process.exit(1);' "$CHATS" "$AUTHOR_ID" || { echo "Chat list failed" >&2; exit 1; }

CONVERSATION="$(api GET "/messages/$AUTHOR_ID" "" "$READER_TOKEN")"
node -e 'const messages = JSON.parse(process.argv[1]); const id = Number(process.argv[2]); if (!messages.some((message) => Number(message.id) === id)) process.exit(1);' "$CONVERSATION" "$DIRECT_MESSAGE_ID" || { echo "Conversation endpoint failed" >&2; exit 1; }

api POST "/messages/$AUTHOR_ID" "{\"body\":\"reply from curl chat\"}" "$READER_TOKEN" >/dev/null
api DELETE "/comments/$COMMENT_ID" "" "$READER_TOKEN" >/dev/null
api DELETE "/reactions/$POST_ID" "" "$READER_TOKEN" >/dev/null
api DELETE "/follow/$AUTHOR_ID" "" "$READER_TOKEN" >/dev/null
api DELETE "/follow/$READER_ID" "" "$AUTHOR_TOKEN" >/dev/null

PROFILE="$(api GET "/users/$AUTHOR_ID")"
node -e 'const profile = JSON.parse(process.argv[1]); const id = Number(process.argv[2]); if (!profile.posts.some((post) => Number(post.id) === id)) process.exit(1);' "$PROFILE" "$POST_ID" || { echo "Profile posts check failed" >&2; exit 1; }

echo "curl smoke tests passed."
