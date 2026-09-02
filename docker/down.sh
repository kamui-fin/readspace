#!/bin/bash
# Stop all services started by launch.sh (development or self-hosted)

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

# Build the docker compose command (mirrors launch.sh logic)
COMPOSE_FILES=("-f" "$SCRIPT_DIR/supabase/docker-compose.yml" "-f" "$SCRIPT_DIR/docker-compose.yml")
ENV_FILES=("--env-file" "$SCRIPT_DIR/supabase/.env" "--env-file" "$SCRIPT_DIR/.env")
PROFILES=()

# Load RSSHUB_MODE from docker/.env to determine if we should include RSSHub profile
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

# Add dev-specific overlay if in development mode
if [ "$DEV_MODE" = true ]; then
    COMPOSE_FILES+=("-f" "$SCRIPT_DIR/supabase/docker-compose.dev.yml")
    print_info "› Stopping Readspace in DEVELOPMENT mode..."
else
    PROFILES+=("app")
    print_info "› Stopping Readspace in SELF-HOSTED mode..."
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

# Stop the main services (supabase + readspace app + optionally rsshub)
if ! docker compose "${COMPOSE_FILES[@]}" "${ENV_FILES[@]}" "${PROFILE_FLAGS[@]}" down; then
    print_error "Failed to stop services."
    exit 1
fi
print_success "✓ All services stopped."

# --- Final Output ---
print_info "🎉 --- Readspace Shutdown Complete! --- 🎉"
echo "All Readspace services have been stopped."
echo ""