# What is it? 
Implementation of a social network for distributing and selling digital content.
The project should include user profiles containing posts, the ability to subscribe, and the ability to create a feed from subscription posts. It should also include the ability to leave reactions and comments under each post, reply to others' comments, and send private messages.
A mock payment system for paid content and site moderation (deleting posts, comments, and profiles from the site interface) should be implemented.

# Work plan
- [X] Dictionary Database Implementation ![Status](https://shields.io)
- [X] Backend Skeleton (Express <-> DB) ![Status](https://shields.io)
- [X] API Contract Markup ![Status](https://shields.io)
- [X] Fully Finished UI in React ![Status](https://shields.io)
- [X] Final Backend Implementation ![Status](https://shields.io)
- - [X] Authentication
- - [X] Posts
- - [X] Profiles
- - [X] Feed
- - [X] Comments
- - [X] Monetization System
- - [X] Search by Tags
- - [X] Private Messages
- - [X] Subscriptions
- [X] Testing and Debugging ![Status](https://shields.io)
- [X] Integration ![Status](https://shields.io)
- [X] Deployment ![Status](https://shields.io)
- [ ] Minor fixes and improvements
- [ ] (optional) Filling with Test Data ![Status](https://shields.io)

---

# Architecture
## Frontend
React SPA with React Router and a small API layer on top of Axios. Pages own local UI state, call backend endpoints directly, and reuse shared components such as layout, post cards, comments, and protected routes.

## Backend
Backend designed using Hexagonal Architecture principles with clear separation between controllers, services, and data access layers.

## Database
Relational MySQL schema built from the data dictionary. Core tables cover users, roles, sessions, posts, post content, tags, follows, comments, reactions, purchases, wallets, and direct messages.

## Contracts
REST API under `/api/v1` with a unified response shape: `{ data, error }`. Authentication uses JWT bearer tokens, while frontend modules unwrap responses before passing data into components.

The contracts are described in [api] (docs/api.md)

# Deploy

## Recreate database

mysql -u [username] -p'[password]' -e "DROP DATABASE IF EXISTS \`SISIII2026_[student_number]\`; CREATE DATABASE \`SISIII2026_[student_number]\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" && mysql -u [username] -p'[password]' SISIII2026_[student_number] < database/schema.sql

## Deploy Linux

Make the script executable once:

```bash
chmod +x scripts/deploy-linux.sh
chmod +x backend/scripts/test-curl.sh
```

Main commands:

```bash
./scripts/deploy-linux.sh deploy
./scripts/deploy-linux.sh test-all
./scripts/deploy-linux.sh start
./scripts/deploy-linux.sh stop
```

Optional Redis-free mode:

```
./scripts/deploy-linux.sh deploy DBOnly
./scripts/deploy-linux.sh start DBOnly
```

What the script does:

- `deploy`: stop app, clean `node_modules`, reinstall dependencies, build frontend, start backend
- `test-all`: run backend Jest coverage, curl smoke tests, and frontend build smoke check
- `start`: start the last successful build only
- `stop`: stop the running backend process

Requirements:

- `backend/.env` for runtime
- `backend/.env.test` for automated tests
- Node.js, npm, curl
