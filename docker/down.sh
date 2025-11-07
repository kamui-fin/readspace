#!/bin/bash
# Stop all services started by launch.sh

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of the docker directory)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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

# --- Stop Services in Reverse Order ---

# Stop RSShub services
if [ -f "$SCRIPT_DIR/docker-compose.rsshub.yml" ]; then
    print_info "› Stopping RSShub services..."
    if ! docker compose -f "$SCRIPT_DIR/docker-compose.rsshub.yml" --env-file "$SCRIPT_DIR/supabase/.env" down; then
        print_error "Failed to stop RSShub services."
        exit 1
    fi
    print_success "✓ RSShub services stopped."
else
    print_info "› No RSShub docker-compose found, skipping RSShub shutdown."
fi

# Stop custom application services
if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    print_info "› Stopping readspace application services..."
    if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/supabase/.env" down; then
        print_error "Failed to stop custom application services."
        exit 1
    fi
    print_success "✓ Custom application services stopped."
else
    print_info "› No docker/docker-compose.yml found, skipping custom service shutdown."
fi

# Stop core Supabase stack
if [ "$DEV_MODE" = true ]; then
    print_info "› Stopping Supabase services (dev mode)..."
    if ! docker compose -f "$SCRIPT_DIR/supabase/docker-compose.yml" -f "$SCRIPT_DIR/supabase/docker-compose.dev.yml" --env-file "$SCRIPT_DIR/supabase/.env" down; then
        print_error "Failed to stop Supabase services in dev mode."
        exit 1
    fi
    print_success "✓ Supabase stack with dev tools stopped."
else
    print_info "› Stopping Supabase services..."
    if ! docker compose -f "$SCRIPT_DIR/supabase/docker-compose.yml" --env-file "$SCRIPT_DIR/supabase/.env" down; then
        print_error "Failed to stop core Supabase services."
        exit 1
    fi
    print_success "✓ Core Supabase stack stopped."
fi

# --- Final Output ---
print_info "🎉 --- Readspace Shutdown Complete! --- 🎉"
echo "All Readspace services have been stopped."
echo ""