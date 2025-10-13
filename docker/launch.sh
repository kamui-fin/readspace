#!/bin/bash
# Automatically determine whether to start RSSHub based on configuration

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# --- Docker Compose Launch ---
print_info "› Starting Supabase services with Docker Compose..."
# Start the core Supabase stack first
if ! docker compose -f "$SCRIPT_DIR/supabase/docker-compose.yml" --env-file "$SCRIPT_DIR/supabase/.env" up -d; then
    print_error "Failed to start core Supabase services. Check Docker and the logs."
    exit 1
fi
print_success "✓ Core Supabase stack is starting in the background."

# Start any other services (like your custom web/server containers)
if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    print_info "› Starting readspace application services..."
    if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/supabase/.env" up -d; then
        print_error "Failed to start custom application services."
        exit 1
    fi
    print_success "✓ Custom application services are starting in the background."
else
    print_info "› No docker/docker-compose.yml found, skipping custom service startup."
fi

# Check if we should start RSShub services
# Load environment to check RSSHUB_URL configuration
if [ -f "$PROJECT_ROOT/server/.env" ]; then
    RSSHUB_URL=$(grep "^RSSHUB_URL=" "$PROJECT_ROOT/server/.env" | cut -d'=' -f2)
fi

# Start RSShub services if using local instance
if [ -f "$SCRIPT_DIR/docker-compose.rsshub.yml" ] && [[ "$RSSHUB_URL" == *":1200"* ]]; then
    print_info "› Starting local RSShub services..."
    if ! docker compose -f "$SCRIPT_DIR/docker-compose.rsshub.yml" --env-file "$SCRIPT_DIR/supabase/.env" up -d; then
        print_error "Failed to start RSShub services."
        exit 1
    fi
    print_success "✓ RSShub services are starting in the background."
elif [ -f "$SCRIPT_DIR/docker-compose.rsshub.yml" ]; then
    print_info "› External RSShub configured, skipping local RSShub startup."
else
    print_info "› No RSShub docker-compose found, skipping RSShub startup."
fi

# --- Final Output ---
print_info "🎉 --- Readspace Setup Complete! --- 🎉"
echo "Your Readspace instance is now running."
echo "You can access the services at the following URLs:"
echo ""
print_success "Readspace Web App: http://localhost:18042"
echo ""
echo "For developers, you can access:"
print_success "Supabase Dashboard: http://localhost:18000"
print_success "RSShub API: http://localhost:1200"
echo ""
echo "It may take a few minutes for all services to become fully available."
echo "Use 'docker compose logs -f' to monitor the startup process."
echo "------------------------------------------------"
