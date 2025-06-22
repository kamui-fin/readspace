#!/bin/bash

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
if ! docker compose -f supabase/docker-compose.yml --env-file supabase/.env up -d; then
    print_error "Failed to start core Supabase services. Check Docker and the logs."
    exit 1
fi
print_success "✓ Core Supabase stack is starting in the background."

# Start any other services (like your custom web/server containers)
# This assumes you have a docker-compose.yml in the root directory for your apps.
if [ -f "docker-compose.yml" ]; then
    print_info "› Starting readspace application services..."
    if ! docker compose --env-file supabase/.env up -d; then
        print_error "Failed to start custom application services."
        exit 1
    fi
    print_success "✓ Custom application services are starting in the background."
else
    print_info "› No root docker-compose.yml found, skipping custom service startup."
fi


# --- Final Output ---
print_info "🎉 --- Readspace Setup Complete! --- 🎉"
echo "Your Readspace instance is now running."
echo "You can access the services at the following URLs:"
echo ""
print_success "Readspace Web App: http://localhost:8042"
echo ""
echo "For developers, you can access Supabase at:"
print_success "Supabase Dashboard: http://localhost:8000"
echo ""
echo "It may take a few minutes for all services to become fully available."
echo "Use 'docker compose logs -f' to monitor the startup process."
echo "------------------------------------------------"
