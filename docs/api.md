# API

## Response format

Successful response:

```json
{
  "data": {},
  "error": null
}
```

Failed response:

```json
{
  "data": null,
  "error": "message"
}
```

## Current routes

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

Register request:

```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

Register response:

```json
{
  "data": {
    "userId": 1
  },
  "error": null
}
```

Login response:

```json
{
  "data": {
    "token": "jwt"
  },
  "error": null
}
```

### Users

- `GET /api/v1/users/me`
- `GET /api/v1/users/me/following`
- `GET /api/v1/users/me/followers`
- `GET /api/v1/users/:id`
- `GET /api/v1/users/:id/following`
- `GET /api/v1/users/:id/followers`

### Posts

- `POST /api/v1/posts`
- `GET /api/v1/posts`
- `GET /api/v1/posts/:id`

Create post request:

```json
{
  "title": "string",
  "description": "string",
  "content": [
    {
      "type": "text | image | video",
      "value": "string"
    }
  ],
  "access": {
    "type": "free | paid",
    "price": 10
  }
}
```

### Comments

- `POST /api/v1/comments`
- `GET /api/v1/comments/post/:postId`
- `DELETE /api/v1/comments/:id`

### Reactions

- `POST /api/v1/reactions`
- `GET /api/v1/reactions/:postId`
- `DELETE /api/v1/reactions/:postId`

### Follow

- `POST /api/v1/follow/:userId`
- `DELETE /api/v1/follow/:userId`

### Feed

- `GET /api/v1/feed`
