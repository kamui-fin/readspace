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
# Re-running this script is safe: existing secrets (JWT, Postgres password,
# Meilisearch master key) are reused so a running deployment isn't broken —
# only deployment config (URLs, RSSHub mode, AI settings) is updated. Pass
# --regenerate-secrets to rotate secrets for a fresh instance (refused while
# an existing database container is present — run docker/reset.sh first).
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
export PROJECT_ROOT  # used by docker-compose.yml's build.context / bind-mount interpolation

# Helper function: Set environment variable in a file safely
set_env_var() {
    local file="$1"
    local key="$2"
    local value="$3"

    # If the key exists, replace its value (anchored line match)
    if grep -q "^${key}=" "$file"; then
        # Pure-bash rewrite: avoids sed delimiter/metacharacter escaping
        # issues (values like JWT secrets or URLs can contain '/', '&', '\')
        # and GNU-vs-BSD sed -i differences.
        local tmp
        tmp="$(mktemp)"
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ "$line" == "${key}="* ]]; then
                printf '%s=%s\n' "$key" "$value"
            else
                printf '%s\n' "$line"
            fi
        done < "$file" > "$tmp"
        mv "$tmp" "$file"
    else
        # Key doesn't exist, append it
        echo "${key}=${value}" >> "$file"
    fi
}

# Helper function: Validate that required env vars are set and non-empty
validate_env_file() {
    local file="$1"
    shift  # Remove first argument
    local keys=("$@")  # Remaining arguments are the required keys

    for key in "${keys[@]}"; do
        if ! grep -q "^${key}=" "$file"; then
            echo "❌ Error: Required variable '$key' not found in $file" >&2
            return 1
        fi
        local value=$(grep "^${key}=" "$file" | cut -d'=' -f2-)
        if [ -z "$value" ]; then
            echo "❌ Error: Required variable '$key' is empty in $file" >&2
            return 1
        fi
    done
    return 0
}

# --- Parse Flags ---
# Flags may be combined in any order, e.g. `./setup.sh --dev --regenerate-secrets`.
DEV_FLAG=false
REGENERATE_SECRETS=false
for arg in "$@"; do
    case "$arg" in
        --dev) DEV_FLAG=true ;;
        --regenerate-secrets) REGENERATE_SECRETS=true ;;
    esac
done

# --- Secret Reuse / Regeneration Policy ---
#
# Re-running this script should be safe for tweaking deployment config (URLs,
# RSSHub mode, AI settings) without silently rotating every secret out from
# under an already-initialized Postgres database. Postgres only applies
# POSTGRES_PASSWORD when it initializes an empty data directory — once a real
# deployment exists, blindly regenerating breaks auth for every Supabase
# service until the database is wiped too. So: reuse existing secrets by
# default, and require --regenerate-secrets (refused while a database
# container still exists) to opt into rotating them.
SUPABASE_ENV="$SCRIPT_DIR/supabase/.env"

REUSE_SECRETS=false
if [ -f "$SUPABASE_ENV" ] && validate_env_file "$SUPABASE_ENV" \
    "POSTGRES_PASSWORD" "JWT_SECRET" "ANON_KEY" "SERVICE_ROLE_KEY" \
    "SECRET_KEY_BASE" "VAULT_ENC_KEY" >/dev/null 2>&1; then
    REUSE_SECRETS=true
fi

if [ "$REGENERATE_SECRETS" = true ]; then
    if command -v docker &>/dev/null && docker container inspect supabase-db &>/dev/null; then
        echo "❌ Error: --regenerate-secrets was requested, but an existing Supabase" >&2
        echo "   database container ('supabase-db') was found." >&2
        echo "" >&2
        echo "   Rotating secrets now would leave Postgres holding a password that no" >&2
        echo "   longer matches docker/supabase/.env, breaking auth for every Supabase" >&2
        echo "   service (auth, storage, realtime, PostgREST)." >&2
        echo "" >&2
        echo "   Run 'docker/reset.sh' first to wipe all data volumes, then re-run" >&2
        echo "   this command to provision a fresh instance." >&2
        exit 1
    fi
    REUSE_SECRETS=false
    echo "🔄 --regenerate-secrets passed — generating fresh secrets."
fi

# --- Access Configuration ---
# Check if --dev flag is provided
if [ "$DEV_FLAG" = true ]; then
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
        read -p "IP address [localhost]: " API_HOST
        API_HOST=${API_HOST:-"localhost"}

        WEB_URL="http://${API_HOST}:18042"
        API_URL="http://${API_HOST}:18008"
        SUPABASE_PUBLIC_URL="http://${API_HOST}:18000"
        MEILISEARCH_PUBLIC_URL="http://${API_HOST}:7700"

        echo "✅ Access via $API_HOST"
    fi
fi

# --- RSSHub Configuration ---
if [ "$ACCESS_TYPE" = "dev" ]; then
    # Dev mode: always use local RSSHub
    RSSHUB_URL="http://localhost:1200"
    RSSHUB_MODE="local"
    echo ""
    echo "📡 RSSHub: Using local instance at ${RSSHUB_URL}"
else
    echo ""
    echo "📡 RSSHub Configuration"
    echo "RSSHub generates RSS feeds for websites that don't natively provide them."
    echo "You can use a local instance (included with setup, but pulls a headless-browser"
    echo "image and adds ~1.5GB of disk usage) or an external one (defaults to the public"
    echo "instance at https://rsshub.app if you don't have your own)."
    echo ""
    read -p "Use local RSSHub instance? [Y/n]: " USE_LOCAL_RSSHUB_INPUT
    USE_LOCAL_RSSHUB_INPUT=${USE_LOCAL_RSSHUB_INPUT:-"Y"}

    if [[ "$USE_LOCAL_RSSHUB_INPUT" =~ ^[Yy]$ ]]; then
        RSSHUB_MODE="local"
        # For domain mode, RSSHub is accessed via Docker network; for IP mode use the configured host
        if [ "$ACCESS_TYPE" = "2" ]; then
            RSSHUB_URL="http://rsshub:1200"
        else
            RSSHUB_URL="http://${API_HOST}:1200"
        fi
        echo "✅ Local RSSHub instance will be used at ${RSSHUB_URL}"
    else
        RSSHUB_MODE="external"
        echo ""
        read -p "Enter your external RSSHub URL [https://rsshub.app]: " EXTERNAL_RSSHUB_URL
        RSSHUB_URL=${EXTERNAL_RSSHUB_URL:-"https://rsshub.app"}
        echo "✅ External RSSHub configured: ${RSSHUB_URL}"
    fi
fi

# --- AI Configuration (unified for dev and self-host) ---
echo ""
echo "🤖 AI Support"
read -p "Enable AI features (summaries, translations, similarity)? [Y/n]: " ENABLE_AI_INPUT
ENABLE_AI_INPUT=${ENABLE_AI_INPUT:-"Y"}

if [[ "$ENABLE_AI_INPUT" =~ ^[Yy]$ ]]; then
    ENABLE_AI="true"
    echo "Get a Gemini API key at: https://aistudio.google.com/app/apikey"
    read -p "Gemini API key (or press Enter to configure later): " GEMINI_API_KEY
    GEMINI_API_KEY=${GEMINI_API_KEY:-""}
else
    ENABLE_AI="false"
    GEMINI_API_KEY=""
fi


# --- Configuration & Input Validation ---

# Check for required command-line tools.
for cmd in openssl jq tr curl docker; do
  if ! command -v "$cmd" &> /dev/null;
  then
    echo "Error: Required command '$cmd' is not installed." >&2
    exit 1
  fi
done

# --- Generate/Preserve Meilisearch Master Key ---
DOCKER_ENV="$SCRIPT_DIR/.env"

if [ "$REUSE_SECRETS" = true ] && [ -f "$DOCKER_ENV" ] && grep -q "^MEILISEARCH_MASTER_KEY=." "$DOCKER_ENV"; then
    echo "🔐 Existing Meilisearch master key found — reusing it."
    MEILISEARCH_MASTER_KEY=$(grep "^MEILISEARCH_MASTER_KEY=" "$DOCKER_ENV" | cut -d'=' -f2-)
else
    echo "🔐 Generating secure Meilisearch master key..."
    MEILISEARCH_MASTER_KEY=$(openssl rand -hex 32)
fi

# Merge keys in place rather than clobbering the whole file — a re-run must
# not destroy a previously-fetched MEILISEARCH_SEARCH_KEY or hand edits.
if [ ! -f "$DOCKER_ENV" ]; then
    echo "# This file was auto-generated by setup.sh" > "$DOCKER_ENV"
fi
set_env_var "$DOCKER_ENV" "MEILISEARCH_MASTER_KEY" "$MEILISEARCH_MASTER_KEY"
set_env_var "$DOCKER_ENV" "API_URL" "$API_URL"
set_env_var "$DOCKER_ENV" "WEB_URL" "$WEB_URL"
set_env_var "$DOCKER_ENV" "SUPABASE_PUBLIC_URL" "$SUPABASE_PUBLIC_URL"
set_env_var "$DOCKER_ENV" "MEILISEARCH_PUBLIC_URL" "$MEILISEARCH_PUBLIC_URL"
set_env_var "$DOCKER_ENV" "RSSHUB_MODE" "$RSSHUB_MODE"
echo "✅ Meilisearch master key and deployment URLs saved to docker/.env."

# Validate that initial config was written correctly
if ! validate_env_file "$SCRIPT_DIR/.env" \
    "MEILISEARCH_MASTER_KEY" "RSSHUB_MODE"; then
    exit 1
fi

# --- Start Meilisearch to generate search key ---
echo "🚀 Starting Meilisearch container with the generated master key..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" --env-file "$SCRIPT_DIR/.env" \
    --project-name "readspace" up -d meilisearch

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
set_env_var "$SCRIPT_DIR/.env" "MEILISEARCH_SEARCH_KEY" "$MEILISEARCH_SEARCH_KEY"
echo "✅ Search API key saved to docker/.env."

# Validate that Meilisearch keys are now set
if ! validate_env_file "$SCRIPT_DIR/.env" \
    "MEILISEARCH_MASTER_KEY" "MEILISEARCH_SEARCH_KEY" "RSSHUB_MODE"; then
    exit 1
fi

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
    if netstat -ln 2>/dev/null | grep -q -E "[:.]$port[[:space:]]"; then
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
  openssl enc -base64 -A | tr '+/' '-_' | tr -d '=\r\n'
}

# --- JWT + Other Secrets ---

if [ "$REUSE_SECRETS" = true ]; then
    echo "🔑 Existing secrets found in docker/supabase/.env — reusing them."
    echo "   (Pass --regenerate-secrets to rotate; run docker/reset.sh first if a database already exists.)"
    JWT_SECRET=$(grep "^JWT_SECRET=" "$SUPABASE_ENV" | cut -d'=' -f2-)
    ANON_KEY=$(grep "^ANON_KEY=" "$SUPABASE_ENV" | cut -d'=' -f2-)
    SERVICE_ROLE_KEY=$(grep "^SERVICE_ROLE_KEY=" "$SUPABASE_ENV" | cut -d'=' -f2-)
    POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$SUPABASE_ENV" | cut -d'=' -f2-)
    SECRET_KEY_BASE=$(grep "^SECRET_KEY_BASE=" "$SUPABASE_ENV" | cut -d'=' -f2-)
    VAULT_ENC_KEY=$(grep "^VAULT_ENC_KEY=" "$SUPABASE_ENV" | cut -d'=' -f2-)
else
    echo "🔑 Generating JWT secret and tokens..."

    # Generate the main JWT secret used to sign all tokens.
    JWT_SECRET=$(gen_hex 32)

    # Common JWT header.
    header='{"typ":"JWT","alg":"HS256"}'
    header_base64=$(printf %s "$header" | base64_url_encode)

    # Set common timestamps for both tokens (iat: issued at, exp: expiration).
    iat=$(date +%s)
    # Set expiry to 5 years from now.
    exp=$((iat + 5 * 365 * 24 * 3600))

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
fi

# --- Create docker/supabase/.env ---
if [ ! -f "$SCRIPT_DIR/supabase/.env.example" ]; then
    echo "Error: $SCRIPT_DIR/supabase/.env.example not found!" >&2
    echo "Please ensure you are in the correct directory and the file exists." >&2
    exit 1
fi

echo "📝 Creating docker/supabase/.env file..."
cp "$SCRIPT_DIR/supabase/.env.example" "$SCRIPT_DIR/supabase/.env"

# Use the helper function for safe, anchored replacements
set_env_var "$SCRIPT_DIR/supabase/.env" "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"
set_env_var "$SCRIPT_DIR/supabase/.env" "JWT_SECRET" "$JWT_SECRET"
set_env_var "$SCRIPT_DIR/supabase/.env" "ANON_KEY" "$ANON_KEY"
set_env_var "$SCRIPT_DIR/supabase/.env" "SERVICE_ROLE_KEY" "$SERVICE_ROLE_KEY"
set_env_var "$SCRIPT_DIR/supabase/.env" "DASHBOARD_PASSWORD" "not_being_used"
set_env_var "$SCRIPT_DIR/supabase/.env" "SECRET_KEY_BASE" "$SECRET_KEY_BASE"
set_env_var "$SCRIPT_DIR/supabase/.env" "VAULT_ENC_KEY" "$VAULT_ENC_KEY"
set_env_var "$SCRIPT_DIR/supabase/.env" "API_EXTERNAL_URL" "https://$DOMAIN"
set_env_var "$SCRIPT_DIR/supabase/.env" "SUPABASE_PUBLIC_URL" "https://$DOMAIN"
set_env_var "$SCRIPT_DIR/supabase/.env" "ENABLE_EMAIL_AUTOCONFIRM" "$AUTO_CONFIRM_EMAIL"

# Validate critical keys
if ! validate_env_file "$SCRIPT_DIR/supabase/.env" \
    "POSTGRES_PASSWORD" "JWT_SECRET" "ANON_KEY" "SERVICE_ROLE_KEY" \
    "SECRET_KEY_BASE" "VAULT_ENC_KEY"; then
    exit 1
fi
echo "✅ docker/supabase/.env created and validated."

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

# Polar Checkout Configuration (Production)
# NEXT_PUBLIC_POLAR_CHECKOUT_URL=https://polar.sh/checkout/your_checkout_id_here
# NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID=your_monthly_product_id_here
# NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID=your_yearly_product_id_here
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
ENABLE_AI=${ENABLE_AI}
GEMINI_API_KEY=${GEMINI_API_KEY}
GEMINI_SMART_MODEL=gemini-3.6-flash
GEMINI_FAST_MODEL=gemini-3.5-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

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
GEMINI_SMART_MODEL=gemini-3.6-flash
GEMINI_FAST_MODEL=gemini-3.5-flash-lite
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
