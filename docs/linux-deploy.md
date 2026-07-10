# Linux deployment without Docker

This project is deployed on Linux as one Node.js backend process that also serves the built frontend bundle. Docker files can stay in the repo for local work, but the deployment flow below does not use Docker at all.

## Prerequisites

- Node.js
- npm
- curl
- existing MySQL-compatible database
- `backend/.env` for runtime
- `backend/.env.test` for automated tests

## One-time setup

```bash
chmod +x scripts/deploy-linux.sh
chmod +x backend/scripts/test-curl.sh
```

## Main commands

```bash
./scripts/deploy-linux.sh deploy
./scripts/deploy-linux.sh test-all
./scripts/deploy-linux.sh start
./scripts/deploy-linux.sh stop
```

Optional Redis-free mode:

```bash
./scripts/deploy-linux.sh deploy DBOnly
./scripts/deploy-linux.sh start DBOnly
```

## What each command does

- `deploy`: stop app, clean `node_modules`, reinstall dependencies, build frontend, start backend
- `test-all`: run backend Jest coverage, curl smoke tests, and frontend build smoke check
- `start`: start the last successful build
- `stop`: stop the running backend

## Notes

- Before dependency reinstall, the script prints any lingering `.nfs*` handles for `bcrypt` and removes backend/frontend `node_modules` twice to match the current server workaround.
- `DBOnly` sets `DB_ONLY=1` and fully disables Redis for that run.
- Runtime PID file: `.deploy/run/backend.pid`
- Runtime logs: `.deploy/logs/backend.log`
