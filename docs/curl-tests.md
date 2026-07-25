# curl API checks

Base URL used below:

```bash
export API_BASE_URL="http://localhost:10000/api/v1"
```

PowerShell equivalent:

```powershell
$env:API_BASE_URL = "http://localhost:10000/api/v1"
```

## 1. Register two users

```bash
curl -s -X POST "$API_BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"author","email":"author@test.com","password":"123456"}'
```

```bash
curl -s -X POST "$API_BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"reader","email":"reader@test.com","password":"123456"}'
```

## 2. Login and save tokens

```bash
curl -s -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"author@test.com","password":"123456"}'
```

```bash
curl -s -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"reader@test.com","password":"123456"}'
```

Save the returned JWTs as `AUTHOR_TOKEN` and `READER_TOKEN`.

## 3. Load current users

```bash
curl -s "$API_BASE_URL/users/me" \
  -H "Authorization: Bearer $AUTHOR_TOKEN"
```

```bash
curl -s "$API_BASE_URL/users/me" \
  -H "Authorization: Bearer $READER_TOKEN"
```

Save the author's id as `AUTHOR_ID`.

You should also see `wallet_balance: 100` for both users.

## 4. Update profile

```bash
curl -s -X PUT "$API_BASE_URL/users/me" \
  -H "Authorization: Bearer $AUTHOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name":"Author Updated",
    "bio":"Updated through API",
    "status":"creator",
    "avatar_url":"https://example.com/avatar.png"
  }'
```

## 5. Follow and follower lists

```bash
curl -s -X POST "$API_BASE_URL/follow/$AUTHOR_ID" \
  -H "Authorization: Bearer $READER_TOKEN"
```

```bash
curl -s "$API_BASE_URL/users/me/following" \
  -H "Authorization: Bearer $READER_TOKEN"
```

```bash
curl -s "$API_BASE_URL/users/me/followers" \
  -H "Authorization: Bearer $AUTHOR_TOKEN"
```

```bash
curl -s "$API_BASE_URL/users/$AUTHOR_ID/followers"
```

```bash
curl -s "$API_BASE_URL/users/$AUTHOR_ID/following"
```

## 6. Create paid tagged post

```bash
curl -s -X POST "$API_BASE_URL/posts" \
  -H "Authorization: Bearer $AUTHOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"First post",
    "description":"Post from curl",
    "content":[{"type":"text","value":"Hello from curl"}],
    "tags":["curl","smoke"],
    "access":{"type":"paid","price":15}
  }'
```

Save returned `postId` as `POST_ID`.

## 7. Read feeds, search by tag, and purchase

```bash
curl -s "$API_BASE_URL/posts?tag=curl" \
  -H "Authorization: Bearer $READER_TOKEN"
```

```bash
curl -s "$API_BASE_URL/feed" \
  -H "Authorization: Bearer $READER_TOKEN"
```

```bash
curl -s "$API_BASE_URL/posts/$POST_ID" \
  -H "Authorization: Bearer $READER_TOKEN"
```

Before purchase, the paid post should be visible but locked.

```bash
curl -s -X POST "$API_BASE_URL/posts/$POST_ID/purchase" \
  -H "Authorization: Bearer $READER_TOKEN"
```

```bash
curl -s "$API_BASE_URL/posts/$POST_ID" \
  -H "Authorization: Bearer $READER_TOKEN"
```

After purchase, content should be unlocked and the buyer wallet should be reduced.

## 8. Comments

```bash
curl -s -X POST "$API_BASE_URL/comments" \
  -H "Authorization: Bearer $READER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"postId\":$POST_ID,\"content\":\"Nice post\"}"
```

Save returned `commentId` as `COMMENT_ID`.

```bash
curl -s "$API_BASE_URL/comments/post/$POST_ID"
```

```bash
curl -s -X DELETE "$API_BASE_URL/comments/$COMMENT_ID" \
  -H "Authorization: Bearer $READER_TOKEN"
```

## 9. Reactions and likers

```bash
curl -s -X POST "$API_BASE_URL/reactions" \
  -H "Authorization: Bearer $READER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"postId\":$POST_ID,\"type\":\"like\"}"
```

```bash
curl -s "$API_BASE_URL/reactions/$POST_ID"
```

```bash
curl -s "$API_BASE_URL/posts/$POST_ID/reactions/users" \
  -H "Authorization: Bearer $AUTHOR_TOKEN"
```

```bash
curl -s -X DELETE "$API_BASE_URL/reactions/$POST_ID" \
  -H "Authorization: Bearer $READER_TOKEN"
```

## 10. User profile

```bash
curl -s "$API_BASE_URL/users/$AUTHOR_ID"
```

## 11. Unfollow

```bash
curl -s -X DELETE "$API_BASE_URL/follow/$AUTHOR_ID" \
  -H "Authorization: Bearer $READER_TOKEN"
```

## Expected response contract

Every endpoint should answer in the same envelope:

```json
{
  "data": "...",
  "error": null
}
```
