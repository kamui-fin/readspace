#!/bin/bash
# Stop all services started by launch.sh

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

# Check if we should stop RSShub services
if [ -f "server/.env" ]; then
    RSSHUB_URL=$(grep "^RSSHUB_URL=" server/.env | cut -d'=' -f2)
fi

# Stop RSShub services if they were started
if [ -f "docker/docker-compose.rsshub.yml" ] && [[ "$RSSHUB_URL" == *":1200"* ]]; then
    print_info "› Stopping local RSShub services..."
    if ! docker compose -f docker/docker-compose.rsshub.yml --env-file docker/supabase/.env down; then
        print_error "Failed to stop RSShub services."
        exit 1
    fi
    print_success "✓ RSShub services stopped."
elif [ -f "docker/docker-compose.rsshub.yml" ]; then
    print_info "› External RSShub was configured, no local RSShub to stop."
else
    print_info "› No RSShub docker-compose found, skipping RSShub shutdown."
fi

# Stop custom application services
if [ -f "docker/docker-compose.yml" ]; then
    print_info "› Stopping readspace application services..."
    if ! docker compose -f docker/docker-compose.yml --env-file docker/supabase/.env down; then
        print_error "Failed to stop custom application services."
        exit 1
    fi
    print_success "✓ Custom application services stopped."
else
    print_info "› No docker/docker-compose.yml found, skipping custom service shutdown."
fi

# Stop core Supabase stack
print_info "› Stopping Supabase services..."
if ! docker compose -f docker/supabase/docker-compose.yml --env-file docker/supabase/.env down; then
    print_error "Failed to stop core Supabase services."
    exit 1
fi
print_success "✓ Core Supabase stack stopped."

# --- Final Output ---
print_info "🎉 --- Readspace Shutdown Complete! --- 🎉"
echo "All Readspace services have been stopped."
echo ""