#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend/content-platform-ui"
RUN_DIR="$ROOT_DIR/.deploy/run"
LOG_DIR="$ROOT_DIR/.deploy/logs"
PID_FILE="$RUN_DIR/backend.pid"
PGID_FILE="$RUN_DIR/backend.pgid"
BUILD_MARKER="$RUN_DIR/last-build.ok"
ACTION="${1:-deploy}"
MODE_FLAG="${2:-}"

if [[ "$MODE_FLAG" =~ ^(DBOnly|dbonly|--db-only)$ ]]; then
    DB_ONLY_MODE=1
else
    DB_ONLY_MODE=0
fi

log() {
    printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "Required command not found: $1" >&2
        exit 1
    }
}

ensure_dirs() {
    mkdir -p "$RUN_DIR" "$LOG_DIR"
}

ensure_backend_env() {
    [[ -f "$BACKEND_DIR/.env" ]] || {
        echo "Missing $BACKEND_DIR/.env" >&2
        exit 1
    }
}

ensure_test_env() {
    [[ -f "$BACKEND_DIR/.env.test" ]] || {
        echo "Missing $BACKEND_DIR/.env.test" >&2
        exit 1
    }
}

with_db_only_env() {
    if [[ "$DB_ONLY_MODE" -eq 1 ]]; then
        env DB_ONLY=1 "$@"
    else
        "$@"
    fi
}

app_port() {
    local env_port=""
    env_port="$(grep -E '^PORT=' "$BACKEND_DIR/.env" | tail -n 1 | cut -d '=' -f 2- | tr -d '\r' || true)"
    echo "${PORT:-${env_port:-5000}}"
}

show_bcrypt_nfs_handles() {
    local pattern="$BACKEND_DIR/node_modules/bcrypt/prebuilds/linux-x64/.nfs*"
    if command -v lsof >/dev/null 2>&1 && compgen -G "$pattern" >/dev/null; then
        lsof "$BACKEND_DIR"/node_modules/bcrypt/prebuilds/linux-x64/.nfs* || true
    fi
}

clean_dependencies() {
    log "Cleaning dependency directories"
    show_bcrypt_nfs_handles
    rm -rf "$BACKEND_DIR/node_modules" "$FRONTEND_DIR/node_modules" || true
    rm -rf "$BACKEND_DIR/node_modules" "$FRONTEND_DIR/node_modules" || true
}

install_dependencies() {
    log "Installing backend dependencies"
    (cd "$BACKEND_DIR" && npm ci --no-audit --no-fund)

    log "Installing frontend dependencies"
    (cd "$FRONTEND_DIR" && npm ci --no-audit --no-fund)
}

build_frontend() {
    log "Building frontend"
    (cd "$FRONTEND_DIR" && with_db_only_env env VITE_API_BASE_URL=/api/v1 npm run build)
    date '+%Y-%m-%d %H:%M:%S' > "$BUILD_MARKER"
}

process_group_is_running() {
    [[ -f "$PGID_FILE" ]] || return 1

    local pgid
    pgid="$(cat "$PGID_FILE" 2>/dev/null || true)"

    [[ -n "$pgid" ]] || return 1
    pgrep -g "$pgid" >/dev/null 2>&1
}

is_running() {
  process_group_is_running
}

stop_backend() {
    if ! is_running; then
        rm -f "$PID_FILE" "$PGID_FILE"
        log "Backend is not running"
        return
    fi

    local pgid
    pgid="$(cat "$PGID_FILE")"

    log "Stopping backend process group $pgid"
    kill -TERM "-$pgid" >/dev/null 2>&1 || true

    for _ in {1..20}; do
        if ! process_group_is_running; then
            rm -f "$PID_FILE" "$PGID_FILE"
            log "Backend stopped"
            return
        fi
        sleep 1
    done

    log "Backend did not stop gracefully, killing process group $pgid"
    kill -KILL "-$pgid" >/dev/null 2>&1 || true

    for _ in {1..10}; do
        if ! process_group_is_running; then
            rm -f "$PID_FILE" "$PGID_FILE"
            log "Backend killed"
            return
        fi
        sleep 1
    done

    echo "Backend process group is still alive: $pgid" >&2
    exit 1
}

start_backend() {
    ensure_dirs
    ensure_backend_env
    [[ -f "$BUILD_MARKER" && -f "$FRONTEND_DIR/dist/index.html" ]] || {
        echo "No successful frontend build found. Run deploy first." >&2
        exit 1
    }

    if is_running; then
        log "Backend is already running with PID $(cat "$PID_FILE")"
        return
    fi

    local port
    port="$(app_port)"

    log "Starting backend on port $port"
    (
        cd "$BACKEND_DIR"

        if [[ "$DB_ONLY_MODE" -eq 1 ]]; then
            nohup setsid env DB_ONLY=1 NODE_ENV=production npm start >>"$LOG_DIR/backend.log" 2>&1 &
        else
            nohup setsid env NODE_ENV=production npm start >>"$LOG_DIR/backend.log" 2>&1 &
        fi

        pid="$!"
        echo "$pid" > "$PID_FILE"
        echo "$pid" > "$PGID_FILE"
    )

    for _ in {1..30}; do
        if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
            log "Application is up. PID: $(cat "$PID_FILE")"
            return
        fi
        sleep 1
    done

    echo "Application did not pass health check. Check $LOG_DIR/backend.log" >&2
    exit 1
}

deploy() {
    require_command node
    require_command npm
    require_command curl
    require_command setsid
    require_command pgrep
    ensure_backend_env
    ensure_dirs
    stop_backend
    clean_dependencies
    install_dependencies
    build_frontend
    start_backend
}

test_all() {
    require_command node
    require_command npm
    require_command curl
    ensure_backend_env
    ensure_test_env

    log "Running backend coverage tests"
    (cd "$BACKEND_DIR" && npm run test:coverage)

    log "Running curl smoke tests"
    (cd "$BACKEND_DIR" && with_db_only_env ./scripts/test-curl.sh)

    log "Running frontend build smoke check"
    (cd "$FRONTEND_DIR" && with_db_only_env env VITE_API_BASE_URL=/api/v1 npm run build)
}

case "$ACTION" in
    deploy)
        deploy
        ;;
    test-all)
        test_all
        ;;
    start)
        require_command curl
        require_command setsid
        require_command pgrep
        start_backend
        ;;
    stop)
        require_command pgrep
        stop_backend
        ;;
    *)
        cat <<EOF
Usage: $(basename "$0") [deploy|test-all|start|stop] [DBOnly]

deploy    Clean dependencies, install, build, start
test-all  Run backend coverage tests, curl smoke tests, frontend build smoke check
start     Start the last successful build
stop      Stop the running backend

Optional flag:
  DBOnly  Disable Redis completely for this run
EOF
        exit 1
        ;;
esac
