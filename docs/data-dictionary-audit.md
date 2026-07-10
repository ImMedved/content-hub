# Data Dictionary Audit

Source: `Alexander Kukharev Seminar Systems III.pdf` data dictionary section.

## Table mapping

The current schema in [database/schema.sql](C:/Users/Akku/Documents/content-platform/database/schema.sql) now covers the dictionary tables with one intentional naming correction:

| PDF dictionary | Current table | Status |
| --- | --- | --- |
| `user` | `users` | renamed to avoid reserved-word conflict |
| `session` | `session` | present |
| `role` | `role` | present |
| `user_role` | `users_role` | renamed to match `users` |
| `post` | `post` | present |
| `post_content` | `post_content` | present |
| `tag` | `tag` | present |
| `post_tag` | `post_tag` | present |
| `comment` | `comment` | present |
| `reaction` | `reaction` | present |
| `follow` | `follow` | present |
| `feed_event` | `feed_event` | present |
| `post_access` | `post_access` | present |
| `wallet` | `wallet` | present |
| `transaction` | `payment_transaction` | kept under a safer explicit name |
| `access_grant` | `access_grant` | present |
| `moderation_action` | `moderation_action` | present |

## Initialization notes

- Test initialization reads the shared schema file directly from `database/schema.sql`.
- Legacy `user` and `user_role` cleanup is still handled in [backend/src/tests/initDb.js](C:/Users/Akku/Documents/content-platform/backend/src/tests/initDb.js) so old test databases do not break schema creation.
- Backend repositories now target `users` and `users_role` instead of the reserved `user` name.

## Remaining infrastructure requirement

Backend tests require a running MySQL instance configured by `backend/.env.test`. At the moment of verification, the code was ready but MySQL on `localhost:3306` was not accepting connections, so schema/test execution could not complete in this environment.
