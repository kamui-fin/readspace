#!/bin/bash

# Configuration for RSSHub instance (local or external)

# ==============================================================================
# Production Self-Host Configuration Script
#
# This script automates the setup of a self-hosted Readspace instance by:
# 1. Collecting deployment configuration (IP:PORT or custom domain)
# 2. Generating all necessary secrets (passwords, JWT keys, etc.)
# 3. Creating environment files with deployment-specific URLs
#
# Usage:
# 1. Navigate to the docker/ directory
# 2. Make it executable: chmod +x setup.sh
# 3. Run it:
#    - For production with custom domain: ./setup.sh
#    - For local development: ./setup.sh --dev
#
# It will create the following files:
# - docker/supabase/.env (Supabase secrets and config)
# - docker/.env (Meilisearch secrets)
# - apps/web/.env (Frontend public URLs)
# - server/.env (Backend configuration)
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status.

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# --- Access Configuration ---
# Check if --dev flag is provided
if [ "$1" = "--dev" ]; then
    ACCESS_TYPE="dev"
    API_HOST="localhost"

    WEB_URL="http://localhost:8042"
    API_URL="http://localhost:8008"
    SUPABASE_PUBLIC_URL="http://localhost:18000"
    MEILISEARCH_PUBLIC_URL="http://localhost:7700"

    echo ""
    echo "🌐 Development Mode"
    echo "✅ Auto-configured for localhost development"
else
    echo ""
    echo "🌐 Production Configuration"
    echo "Choose how you'll access Readspace:"
    echo ""
    echo "1) IP address with ports (e.g., http://192.168.1.100:18042)"
    echo "   └─ For private network access"
    echo ""
    echo "2) Custom domain with reverse proxy (e.g., https://app.example.com)"
    echo "   └─ For production deployment with your own reverse proxy"
    echo ""
    read -p "Select option [1/2] (default: 1): " ACCESS_TYPE
    ACCESS_TYPE=${ACCESS_TYPE:-1}

    if [ "$ACCESS_TYPE" = "2" ]; then
        echo ""
        echo "📋 Domain Configuration"
        echo "Enter the full URLs for each service (including http:// or https://)"
        echo ""
        read -p "Web app URL (e.g., https://app.example.com): " WEB_URL
        read -p "API URL (e.g., https://api.example.com): " API_URL
        read -p "Supabase URL (e.g., https://supabase.example.com): " SUPABASE_PUBLIC_URL
        read -p "Meilisearch URL (e.g., https://search.example.com): " MEILISEARCH_PUBLIC_URL

        echo ""
        echo "✅ Domain configuration:"
        echo "   Web:         ${WEB_URL}"
        echo "   API:         ${API_URL}"
        echo "   Supabase:    ${SUPABASE_PUBLIC_URL}"
        echo "   Meilisearch: ${MEILISEARCH_PUBLIC_URL}"
    else
        echo ""
        echo "📋 IP Address Configuration"
        echo "Enter your machine's IP address (e.g., 192.168.1.100)"
        echo ""
        read -p "IP Address: " API_HOST
        
        if [ -z "$API_HOST" ]; then
            echo "❌ Error: IP address is required" >&2
            exit 1
        fi

        WEB_URL="http://${API_HOST}:18042"
        API_URL="http://${API_HOST}:18008"
        SUPABASE_PUBLIC_URL="http://${API_HOST}:18000"
        MEILISEARCH_PUBLIC_URL="http://${API_HOST}:7700"

        echo "✅ Using IP:PORT access"
    fi
fi

# --- RSSHub Configuration ---
if [ "$ACCESS_TYPE" = "dev" ]; then
    # Dev mode: always use local RSSHub
    RSSHUB_URL="http://localhost:1200"
    echo ""
    echo "📡 RSSHub: Using local instance at ${RSSHUB_URL}"
else
    echo ""
    echo "📡 RSSHub Configuration"
    echo "RSSHub generates RSS feeds for websites that don't natively provide them."
    echo "You can use a local instance (included with setup) or an external one."
    echo ""
    read -p "Use local RSSHub instance? [Y/n]: " USE_LOCAL_RSSHUB_INPUT
    USE_LOCAL_RSSHUB_INPUT=${USE_LOCAL_RSSHUB_INPUT:-"Y"}

    if [[ "$USE_LOCAL_RSSHUB_INPUT" =~ ^[Yy]$ ]]; then
        # For domain mode, RSSHub is accessed via Docker network; for IP mode use the configured host
        if [ "$ACCESS_TYPE" = "2" ]; then
            RSSHUB_URL="http://rsshub:1200"
        else
            RSSHUB_URL="http://${API_HOST}:1200"
        fi
        echo "✅ Local RSSHub instance will be used at ${RSSHUB_URL}"
    else
        echo ""
        read -p "Enter your external RSSHub URL: " EXTERNAL_RSSHUB_URL
        if [ -n "$EXTERNAL_RSSHUB_URL" ]; then
            RSSHUB_URL="$EXTERNAL_RSSHUB_URL"
            echo "✅ External RSSHub configured: ${RSSHUB_URL}"
        else
            if [ "$ACCESS_TYPE" = "2" ]; then
                RSSHUB_URL="http://rsshub:1200"
            else
                RSSHUB_URL="http://${API_HOST}:1200"
            fi
            echo "⚠️  No URL provided, defaulting to local instance: ${RSSHUB_URL}"
        fi
    fi
fi

# --- AI Configuration ---
if [ "$ACCESS_TYPE" = "dev" ]; then
    # Dev mode: disable AI by default
    ENABLE_AI="false"
    GEMINI_API_KEY=""
    echo "🤖 AI Support: Disabled in development mode"
else
    echo ""
    echo "🤖 AI Support Configuration"
    echo "You can configure your AI API key later in the server/.env file."
    echo ""
    read -p "Enable AI support? (recommended) [Y/n]: " ENABLE_AI_INPUT
    ENABLE_AI_INPUT=${ENABLE_AI_INPUT:-"Y"}

    if [[ "$ENABLE_AI_INPUT" =~ ^[Yy]$ ]]; then
        ENABLE_AI="true"
        echo "✅ AI support will be enabled."
        echo ""
        echo "To use AI features, you'll need a Gemini API key."
        echo "Get one at: https://aistudio.google.com/app/apikey"
        echo ""
        read -p "Enter your Gemini API key (or leave blank to configure later): " GEMINI_API_KEY
        GEMINI_API_KEY=${GEMINI_API_KEY:-""}

        if [ -n "$GEMINI_API_KEY" ]; then
            echo "✅ Gemini API key configured."
        else
            echo "⚠️  No API key provided. You can add it to server/.env later."
        fi
    else
        ENABLE_AI="false"
        GEMINI_API_KEY=""
        echo "❌ AI support will be disabled."
    fi
fi


# --- Configuration & Input Validation ---

# Check for required command-line tools.
for cmd in openssl jq tr; do
  if ! command -v "$cmd" &> /dev/null;
  then
    echo "Error: Required command '$cmd' is not installed." >&2
    exit 1
  fi
done

# --- Generate Meilisearch Master Key ---
echo "🔐 Generating secure Meilisearch master key..."
MEILISEARCH_MASTER_KEY=$(openssl rand -hex 32)
cat <<EOF > "$SCRIPT_DIR/.env"
# This file was auto-generated by setup.sh
MEILISEARCH_MASTER_KEY=${MEILISEARCH_MASTER_KEY}
API_URL=${API_URL}
WEB_URL=${WEB_URL}
SUPABASE_PUBLIC_URL=${SUPABASE_PUBLIC_URL}
MEILISEARCH_PUBLIC_URL=${MEILISEARCH_PUBLIC_URL}
EOF
echo "✅ Secure Meilisearch master key and deployment URLs saved to docker/.env."

# --- Start Meilisearch to generate search key ---
echo "🚀 Starting Meilisearch container with the generated master key..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/.env" up -d meilisearch

# Wait for Meilisearch to be ready
echo "⏳ Waiting for Meilisearch to be ready..."
for i in {1..30}; do
    if curl -s -f -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" http://localhost:7700/health > /dev/null 2>&1; then
        echo "✅ Meilisearch is ready."
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Error: Meilisearch failed to start within 30 seconds" >&2
        exit 1
    fi
    sleep 1
done

# Fetch the search API key from Meilisearch
echo "🔑 Fetching search API key from Meilisearch..."
MEILISEARCH_SEARCH_KEY=$(curl -s -H "Authorization: Bearer $MEILISEARCH_MASTER_KEY" \
    http://localhost:7700/keys | jq -r '.results[] | select(.name == "Default Search API Key") | .key')

if [ -z "$MEILISEARCH_SEARCH_KEY" ] || [ "$MEILISEARCH_SEARCH_KEY" = "null" ]; then
    echo "❌ Error: Could not fetch search API key from Meilisearch" >&2
    exit 1
fi
echo "MEILISEARCH_SEARCH_KEY=${MEILISEARCH_SEARCH_KEY}" >> "$SCRIPT_DIR/.env"
echo "✅ Search API key fetched and appended to docker/.env."

# --- Port Availability Check ---
echo "🔍 Checking port availability..."

# Define the ports exposed to host
REQUIRED_PORTS=(18000 18008 18042 1200 6379 7700)
OCCUPIED_PORTS=()

# Function to check if a port is in use
check_port() {
  local port=$1
  if command -v lsof &> /dev/null; then
    if lsof -i :$port &> /dev/null; then
      return 0  # Port is occupied
    fi
  elif command -v netstat &> /dev/null; then
    if netstat -ln 2>/dev/null | grep -q ":$port "; then
      return 0  # Port is occupied
    fi
  elif command -v ss &> /dev/null; then
    if ss -ln 2>/dev/null | grep -q ":$port "; then
      return 0  # Port is occupied
    fi
  fi
  return 1  # Port is available
}

# Check each required port
for port in "${REQUIRED_PORTS[@]}"; do
  if check_port $port; then
    OCCUPIED_PORTS+=($port)
  fi
done

# If any ports are occupied, warn and offer to bypass
if [ ${#OCCUPIED_PORTS[@]} -ne 0 ]; then
  echo "⚠️  Warning: The following required ports are already in use:" >&2
  for port in "${OCCUPIED_PORTS[@]}"; do
    echo "  - Port $port" >&2
  done
  echo "" >&2
  echo "If you are re-running setup.sh to update an existing deployment, you can ignore this check." >&2
  read -p "Do you want to ignore this port check and proceed? [y/N]: " PROCEED_PORT_INPUT
  PROCEED_PORT_INPUT=${PROCEED_PORT_INPUT:-"N"}
  if [[ ! "$PROCEED_PORT_INPUT" =~ ^[Yy]$ ]]; then
    exit 1
  fi
  echo "✅ Proceeding despite port conflicts."
fi

echo "✅ All required ports are available."

# Set domain based on access type
if [ "$ACCESS_TYPE" = "2" ]; then
    DOMAIN="localhost"
else
    DOMAIN="${API_HOST}"
fi
# Default value for auto-confirmation, can be 'true' or 'false'
AUTO_CONFIRM_EMAIL="true"

echo "🚀 Starting configuration for domain: $DOMAIN"
echo "------------------------------------------------"

# --- Helper Functions for Secret Generation ---

# Generates a random hexadecimal string of a given length.
# $1: Length of the hex string.
gen_hex() {
  openssl rand -hex "$1"
}

# Encodes a string into URL-safe Base64.
base64_url_encode() {
  openssl enc -base64 -A | tr '+/' '-_' | tr -d '='
}

# --- JWT Generation ---

echo "🔑 Generating JWT secret and tokens..."

# Generate the main JWT secret used to sign all tokens.
JWT_SECRET=$(gen_hex 32)

# Common JWT header.
header='{"typ":"JWT","alg":"HS256"}'
header_base64=$(printf %s "$header" | base64_url_encode)

# Set common timestamps for both tokens (iat: issued at, exp: expiration).
iat=$(date +%s)
# Set expiry to 5 years from now.
exp=$(("$iat" + 5 * 365 * 24 * 3600))

# Generates a complete JWT token.
# $1: The JSON payload for the token.
# The function uses the global $JWT_SECRET, $header_base64, $iat, and $exp.
gen_token() {
  local payload
  # Use jq to inject the iat and exp timestamps into the payload.
  payload=$(echo "$1" | jq --arg jq_iat "$iat" --arg jq_exp "$exp" \
      '.iat=($jq_iat | tonumber) | .exp=($jq_exp | tonumber)')

  local payload_base64
  payload_base64=$(printf %s "$payload" | base64_url_encode)

  local signed_content="${header_base64}.${payload_base64}"

  local signature
  signature=$(printf %s "$signed_content" | openssl dgst -binary -sha256 -hmac "$JWT_SECRET" | base64_url_encode)

  # Return the final token.
  printf '%s' "${signed_content}.${signature}"
}

# Define payloads and generate the anon and service_role tokens.
anon_payload='{"role": "anon", "iss": "supabase"}'
ANON_KEY=$(gen_token "$anon_payload")

service_role_payload='{"role": "service_role", "iss": "supabase"}'
SERVICE_ROLE_KEY=$(gen_token "$service_role_payload")

echo "✅ JWTs generated successfully."

# --- Generate Other Secrets ---
echo "🔐 Generating other required secrets..."
POSTGRES_PASSWORD=$(gen_hex 16)
SECRET_KEY_BASE=$(gen_hex 32)
VAULT_ENC_KEY=$(gen_hex 16)
echo "✅ Secrets generated."

# --- Create docker/supabase/.env ---
if [ ! -f "$SCRIPT_DIR/supabase/.env.example" ]; then
    echo "Error: $SCRIPT_DIR/supabase/.env.example not found!" >&2
    echo "Please ensure you are in the correct directory and the file exists." >&2
    exit 1
fi

echo "📝 Creating docker/supabase/.env file..."
sed \
  -e "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" \
  -e "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" \
  -e "s|ANON_KEY=.*|ANON_KEY=$ANON_KEY|" \
  -e "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY|" \
  -e "s|DASHBOARD_PASSWORD.*|DASHBOARD_PASSWORD=not_being_used|" \
  -e "s|SECRET_KEY_BASE.*|SECRET_KEY_BASE=$SECRET_KEY_BASE|" \
  -e "s|VAULT_ENC_KEY.*|VAULT_ENC_KEY=$VAULT_ENC_KEY|" \
  -e "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://$DOMAIN|" \
  -e "s|SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=https://$DOMAIN|" \
  -e "s|ENABLE_EMAIL_AUTOCONFIRM=.*|ENABLE_EMAIL_AUTOCONFIRM=$AUTO_CONFIRM_EMAIL|" \
  "$SCRIPT_DIR/supabase/.env.example" > "$SCRIPT_DIR/supabase/.env"
echo "✅ docker/supabase/.env created."

# --- Create apps/web/.env ---
echo "📝 Creating apps/web/.env file..."
# Create the directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/apps/web"

cat <<EOF > "$PROJECT_ROOT/apps/web/.env"
# This file was auto-generated by setup.sh

# Public configuration (client-side)
NEXT_PUBLIC_API_BASE_URL=${API_URL}
NEXT_PUBLIC_APP_URL=${WEB_URL}
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_PUBLIC_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}

# Meilisearch configuration (search key for read-only access)
NEXT_PUBLIC_MEILISEARCH_URL=${MEILISEARCH_PUBLIC_URL}
NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY=${MEILISEARCH_SEARCH_KEY}
EOF
echo "✅ apps/web/.env created."


# --- Create apps/mobile/.env ---
echo "📝 Creating apps/mobile/.env file..."
# We write both production and development templates for the mobile app
cat <<EOF > "$PROJECT_ROOT/apps/mobile/.env"
# This file was auto-generated by setup.sh

# Cloud Instance Configuration
EXPO_PUBLIC_CLOUD_API_URL=${API_URL}
EXPO_PUBLIC_CLOUD_SUPABASE_URL=${SUPABASE_PUBLIC_URL}
EXPO_PUBLIC_CLOUD_SUPABASE_ANON_KEY=${ANON_KEY}

# Local Development / Self-Hosted Configuration (Optional)
# If these are uncommented, they override the cloud config above.
# Note: For physical device testing, replace localhost with your local machine's IP (e.g., 192.168.1.50)
EOF

if [ "$ACCESS_TYPE" = "dev" ]; then
cat <<EOF >> "$PROJECT_ROOT/apps/mobile/.env"
EXPO_PUBLIC_SUPABASE_URL=http://localhost:18000
EXPO_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
EXPO_PUBLIC_API_URL=http://localhost:18008
EOF
else
# In IP/custom domain mode, comment them out by default but supply the configured values
cat <<EOF >> "$PROJECT_ROOT/apps/mobile/.env"
# EXPO_PUBLIC_SUPABASE_URL=${SUPABASE_PUBLIC_URL}
# EXPO_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
# EXPO_PUBLIC_API_URL=${API_URL}
EOF
fi
echo "✅ apps/mobile/.env created."


# --- Create server/.env ---
echo "📝 Creating server/.env file..."
# Create the directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/server"

# In dev mode, use localhost URLs for direct access outside Docker
if [ "$ACCESS_TYPE" = "dev" ]; then
cat <<EOF > "$PROJECT_ROOT/server/.env"
# This file was auto-generated by setup.sh (Development Mode)

# Supabase configuration (localhost for development outside Docker)
SUPABASE_URL=http://localhost:18000
SUPABASE_JWT_SECRET=${JWT_SECRET}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SUPABASE_ANON_KEY=${ANON_KEY}

# Database Configuration
# API uses Session Mode (port 5432) with QueuePool for persistent connections
# Workers use Transaction Mode (port 6543) with NullPool for surgical transactions
DATABASE_URL_API=postgresql://postgres.postgres:${POSTGRES_PASSWORD}@localhost:5432/postgres
DATABASE_URL_WORKER=postgresql://postgres.postgres:${POSTGRES_PASSWORD}@localhost:6543/postgres


# Meilisearch Configuration (master key for admin operations)
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=${MEILISEARCH_MASTER_KEY}
MEILISEARCH_INDEX_NAME=feeds

# AI Configuration
ENABLE_AI=false

# RSShub Configuration
RSSHUB_URL=${RSSHUB_URL}
EOF
else
# Production/IP mode: Server uses Docker internal addresses (kong:8000, db:5432)
cat <<EOF > "$PROJECT_ROOT/server/.env"
# This file was auto-generated by setup.sh
# Note: When running via docker-compose, most variables are set there

# Supabase configuration (for production/Docker deployment)
SUPABASE_URL=http://kong:8000
SUPABASE_JWT_SECRET=${JWT_SECRET}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SUPABASE_ANON_KEY=${ANON_KEY}

# Database Configuration
# API uses Session Mode (port 5432) with QueuePool for persistent connections
# Workers use Transaction Mode (port 6543) with NullPool for surgical transactions
DATABASE_URL_API=postgresql://postgres.postgres:${POSTGRES_PASSWORD}@supavisor:5432/postgres
DATABASE_URL_WORKER=postgresql://postgres.postgres:${POSTGRES_PASSWORD}@supavisor:6543/postgres


# Meilisearch Configuration (master key for admin operations)
MEILISEARCH_URL=http://meilisearch:7700
MEILISEARCH_MASTER_KEY=${MEILISEARCH_MASTER_KEY}
MEILISEARCH_INDEX_NAME=feeds

# AI Configuration
ENABLE_AI=${ENABLE_AI}
GEMINI_API_KEY=${GEMINI_API_KEY}
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

# RSShub Configuration
RSSHUB_URL=${RSSHUB_URL}
EOF
fi
echo "✅ server/.env created."

echo "------------------------------------------------"
echo "🎉 All configuration files have been generated successfully!"
echo ""
echo "📁 Created files:"
echo "  • docker/supabase/.env"
echo "  • docker/.env"
echo "  • apps/web/.env"
echo "  • apps/mobile/.env"
echo "  • server/.env"
echo ""
echo "📋 Summary:"
if [ "$ACCESS_TYPE" = "dev" ]; then
    echo "  • Mode:         Development"
    echo "  • API Host:     localhost"
elif [ "$ACCESS_TYPE" = "2" ]; then
    echo "  • Web URL:      ${WEB_URL}"
    echo "  • API URL:      ${API_URL}"
    echo "  • Supabase URL: ${SUPABASE_PUBLIC_URL}"
else
    echo "  • API Host:     $API_HOST"
fi
echo "  • RSSHub URL:   $RSSHUB_URL"
echo "  • AI Support:   $ENABLE_AI"
echo ""

if [ "$ACCESS_TYPE" = "2" ]; then
    echo "⚠️  Reverse Proxy Required"
    echo "Configure your reverse proxy (Traefik, nginx, Caddy, etc.) to route:"
    echo ""
    echo "If proxy runs in Docker (same network):"
    echo "  ${WEB_URL} → readspace_web:8042"
    echo "  ${API_URL} → readspace_api:8008"
    echo "  ${SUPABASE_PUBLIC_URL} → kong:8000"
    echo ""
    echo "If proxy runs on host:"
    echo "  ${WEB_URL} → localhost:18042"
    echo "  ${API_URL} → localhost:18008"
    echo "  ${SUPABASE_PUBLIC_URL} → localhost:18000"
    echo ""
    echo "📖 See docs/reverse-proxy-examples.md for detailed configuration examples"
    echo ""
fi

echo "Next steps:"
if [ "$ACCESS_TYPE" = "dev" ]; then
    echo "1. Run docker/launch.sh --dev to start services in development mode."
else
    echo "1. Run docker/launch.sh to start the services."
fi
if [ "$ACCESS_TYPE" = "2" ]; then
    echo "2. Visit ${WEB_URL} to create your account."
else
    echo "2. Visit http://${API_HOST}:18042 to create your account."
fi
echo "3. Run docker/promote-admin.sh <email> to make your account an admin."
echo ""

if [ "$ACCESS_TYPE" = "1" ]; then
    echo "📱 Access URLs:"
    echo "  • Web App:     http://${API_HOST}:18042"
    echo "  • API Server:  http://${API_HOST}:18008"
    echo "  • Supabase:    http://${API_HOST}:18000"
    echo "  • Meilisearch: http://${API_HOST}:7700"
fi
