#!/bin/bash
# Automatically determine whether to start RSSHub based on configuration

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

# --- Docker Compose Launch ---
if [ "$DEV_MODE" = true ]; then
    print_info "› Starting Supabase services in DEVELOPMENT mode..."
    # Start with dev compose file for additional services (studio, analytics, etc.)
    if ! docker compose -f "$SCRIPT_DIR/supabase/docker-compose.yml" -f "$SCRIPT_DIR/supabase/docker-compose.dev.yml" --env-file "$SCRIPT_DIR/supabase/.env" up -d; then
        print_error "Failed to start Supabase services in dev mode. Check Docker and the logs."
        exit 1
    fi
    print_success "✓ Supabase stack with dev tools is starting in the background."
else
    print_info "› Starting Supabase services with Docker Compose..."
    # Start the core Supabase stack first
    if ! docker compose -f "$SCRIPT_DIR/supabase/docker-compose.yml" --env-file "$SCRIPT_DIR/supabase/.env" up -d; then
        print_error "Failed to start core Supabase services. Check Docker and the logs."
        exit 1
    fi
    print_success "✓ Core Supabase stack is starting in the background."
fi

# Start any other services (like your custom web/server containers)
if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    if [ "$DEV_MODE" = true ]; then
        print_info "› Starting readspace development infrastructure (Redis + Meilisearch)..."
        if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/supabase/.env" --env-file "$SCRIPT_DIR/.env" up -d; then
            print_error "Failed to start infrastructure services."
            exit 1
        fi
        print_success "✓ Database infrastructure is starting in the background (API and Web should be run locally)."
    else
        print_info "› Starting readspace production services (including application containers)..."
        if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/supabase/.env" --env-file "$SCRIPT_DIR/.env" --profile app up -d; then
            print_error "Failed to start application services."
            exit 1
        fi
        print_success "✓ Production application services are starting in the background."
    fi
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
if [ "$DEV_MODE" = true ]; then
    echo "Development tools are available at:"
    print_success "Supabase Studio: http://localhost:18000"
    print_success "Meilisearch: http://localhost:7700"
    print_success "Analytics Dashboard: http://localhost:4000"
    print_success "RSShub API: http://localhost:1200"
else
    echo "For developers, you can access:"
    print_success "Supabase Dashboard: http://localhost:18000"
    print_success "Meilisearch: http://localhost:7700"
    print_success "RSShub API: http://localhost:1200"
fi
echo ""
echo "It may take a few minutes for all services to become fully available."
echo "Use 'docker compose logs -f' to monitor the startup process."
echo "------------------------------------------------"
