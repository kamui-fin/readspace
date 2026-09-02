#!/bin/bash
# Launch Readspace infrastructure and services (development or self-hosted)

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Build the docker compose command
COMPOSE_FILES=("-f" "$SCRIPT_DIR/supabase/docker-compose.yml" "-f" "$SCRIPT_DIR/docker-compose.yml")
ENV_FILES=("--env-file" "$SCRIPT_DIR/supabase/.env" "--env-file" "$SCRIPT_DIR/.env")
PROFILES=()

# Load RSSHUB_MODE from docker/.env to determine if we should enable RSSHub profile
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

# Add dev-specific overlay if in development mode
if [ "$DEV_MODE" = true ]; then
    COMPOSE_FILES+=("-f" "$SCRIPT_DIR/supabase/docker-compose.dev.yml")
    print_info "› Starting Readspace in DEVELOPMENT mode..."
else
    # Add app profile for self-host (full Docker stack)
    PROFILES+=("app")
    print_info "› Starting Readspace in SELF-HOSTED mode..."
fi

# Add RSSHub profile if using local instance
if [ "$RSSHUB_MODE" = "local" ]; then
    PROFILES+=("rsshub")
fi

# Build profile flags
PROFILE_FLAGS=()
for profile in "${PROFILES[@]}"; do
    PROFILE_FLAGS+=("--profile" "$profile")
done

# Print the command being executed (useful for debugging and documentation)
echo "🐳 Docker Compose command:"
echo "docker compose ${COMPOSE_FILES[@]} ${ENV_FILES[@]} ${PROFILE_FLAGS[@]} up -d"
echo ""

# Execute the unified docker compose command
if ! docker compose "${COMPOSE_FILES[@]}" "${ENV_FILES[@]}" "${PROFILE_FLAGS[@]}" up -d; then
    print_error "Failed to start services. Check Docker and the logs."
    exit 1
fi

print_success "✓ All services are starting in the background."

if [ "$RSSHUB_MODE" = "external" ]; then
    print_info "› External RSSHub configured."
fi

# --- Final Output ---
print_info "🎉 --- Readspace Setup Complete! --- 🎉"
echo "Your Readspace instance is now running."
echo ""
print_success "Readspace Web App: http://localhost:18042"
echo ""

if [ "$DEV_MODE" = true ]; then
    echo "Development tools are available at:"
    print_success "Supabase Studio: http://localhost:18000"
    print_success "Supabase Analytics: http://localhost:4000"
    print_success "Meilisearch: http://localhost:7700"
    if [ "$RSSHUB_MODE" = "local" ]; then
        print_success "RSSHub API: http://localhost:1200"
    fi
    echo ""
    echo "Run the following to start application services locally:"
    echo "  cd apps/web && bun dev        # Next.js web app (port 8042)"
    echo "  cd server && poe start        # FastAPI backend (port 8008)"
else
    echo "Self-hosted instance:"
    print_success "Meilisearch: http://localhost:7700"
    if [ "$RSSHUB_MODE" = "local" ]; then
        print_success "RSSHub API: http://localhost:1200"
    fi
    echo ""
    echo "For admin tasks:"
    echo "  ./docker/promote-admin.sh <email>    # Make a user an admin"
    echo "  ./docker/supabase/reset.sh           # Completely reset the database"
fi

echo ""
echo "It may take a few minutes for all services to become fully available."
echo "Monitor startup with: docker compose logs -f"
echo "------------------------------------------------"
