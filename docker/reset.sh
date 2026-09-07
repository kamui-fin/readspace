#!/bin/bash
# Completely reset a Readspace deployment: stop everything and permanently
# delete ALL data (Postgres database, Meilisearch index, Redis cache).
#
# Secrets and configuration in docker/supabase/.env and docker/.env are left
# untouched, so a subsequent launch.sh reinitializes a clean instance using
# the same credentials — no need to re-run setup.sh or rotate secrets.
#
# This is the counterpart to launch.sh: it mirrors the same compose file /
# profile assembly so it tears down exactly what was started.

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for dev mode flag
DEV_MODE=false
if [ "$1" = "--dev" ] || [ "$1" = "-d" ]; then
    DEV_MODE=true
fi

# Function to print colored output
print_info() {
    printf "\n\033[1;34m%s\033[0m\n" "$1"
}

print_success() {
    printf "\033[1;32m%s\033[0m\n" "$1"
}

print_error() {
    printf "\033[1;31mERROR: %s\033[0m\n" "$1" >&2
}

echo "⚠️  WARNING: This will permanently delete ALL Readspace data:"
echo "   - Postgres database (users, feeds, articles — everything in Supabase)"
echo "   - Meilisearch search index"
echo "   - Redis cache"
echo ""
echo "Secrets in docker/supabase/.env and docker/.env are NOT touched — after"
echo "this, launch.sh reinitializes a clean instance with the same credentials."
echo "This action cannot be undone!"
echo ""
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo    # Move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Operation cancelled."
    exit 1
fi

# Build the compose command (mirrors launch.sh logic, so we tear down exactly
# what was started, including the RSSHub/app profiles)
COMPOSE_FILES=("-f" "$SCRIPT_DIR/supabase/docker-compose.yml" "-f" "$SCRIPT_DIR/docker-compose.yml")
ENV_FILES=("--env-file" "$SCRIPT_DIR/supabase/.env" "--env-file" "$SCRIPT_DIR/.env")
# Must match launch.sh's project name/directory pinning, or this targets a different
# (empty) Compose project and silently does nothing.
PROJECT_FLAGS=("--project-directory" "$SCRIPT_DIR" "--project-name" "readspace")
PROFILES=()

# Load RSSHUB_MODE from docker/.env to determine if we should include RSSHub profile
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

# Add dev-specific overlay if in development mode
if [ "$DEV_MODE" = true ]; then
    COMPOSE_FILES+=("-f" "$SCRIPT_DIR/supabase/docker-compose.dev.yml")
    print_info "› Resetting Readspace DEVELOPMENT deployment..."
else
    PROFILES+=("app")
    print_info "› Resetting Readspace SELF-HOSTED deployment..."
fi

# Add RSSHub profile if using local instance (matches launch.sh)
if [ "$RSSHUB_MODE" = "local" ]; then
    PROFILES+=("rsshub")
fi

# Build profile flags
PROFILE_FLAGS=()
for profile in "${PROFILES[@]}"; do
    PROFILE_FLAGS+=("--profile" "$profile")
done

echo "Stopping containers and removing all volumes..."
if ! docker compose "${COMPOSE_FILES[@]}" "${ENV_FILES[@]}" "${PROJECT_FLAGS[@]}" "${PROFILE_FLAGS[@]}" down -v --remove-orphans; then
    print_error "Failed to tear down services."
    exit 1
fi
print_success "✓ All containers and data volumes removed."

# --- Final Output ---
print_info "🎉 --- Reset Complete! --- 🎉"
echo "All Readspace data has been wiped. Secrets were preserved."
echo ""
if [ "$DEV_MODE" = true ]; then
    echo "Run './docker/launch.sh --dev' to start a fresh instance."
else
    echo "Run './docker/launch.sh' to start a fresh instance."
fi
echo ""
