#!/bin/bash

# Configuration for RSSHub instance (local or external)

# ==============================================================================
# Production Self-Host Configuration Script
#
# This script automates the setup of a self-hosted Supabase instance by:
# 1. Generating all necessary secrets (passwords, JWT keys, etc.).
# 2. Creating the main `supabase/.env` file from `.env.example`.
# 3. Creating the `.env` files for the `web` and `server` applications
#    using the same generated secrets for consistency.
#
# Usage:
# 1. Place this script in the root directory of your project.
# 2. Make it executable: chmod +x setup.sh
# 3. Run it: ./setup.sh
#
# It will create the following files:
# - supabase/.env
# - web/.env
# - server/.env
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status.

# --- API Host Configuration ---
echo "Please enter the host of the server"
read -p "API Host (default: 0.0.0.0): " API_HOST
API_HOST=${API_HOST:-"0.0.0.0"}

# --- RSSHub Configuration ---
echo ""
echo "📡 RSSHub Configuration"
echo "RSSHub generates RSS feeds for websites that don't natively provide them."
echo "You can use a local instance (included with setup) or an external one."
echo ""
read -p "Use local RSSHub instance? [Y/n]: " USE_LOCAL_RSSHUB_INPUT
USE_LOCAL_RSSHUB_INPUT=${USE_LOCAL_RSSHUB_INPUT:-"Y"}

if [[ "$USE_LOCAL_RSSHUB_INPUT" =~ ^[Yy]$ ]]; then
    RSSHUB_URL="http://${API_HOST}:1200"
    echo "✅ Local RSSHub instance will be used at ${RSSHUB_URL}"
else
    echo ""
    read -p "Enter your external RSSHub URL: " EXTERNAL_RSSHUB_URL
    if [ -n "$EXTERNAL_RSSHUB_URL" ]; then
        RSSHUB_URL="$EXTERNAL_RSSHUB_URL"
        echo "✅ External RSSHub configured: ${RSSHUB_URL}"
    else
        RSSHUB_URL="http://${API_HOST}:1200"
        echo "⚠️  No URL provided, defaulting to local instance: ${RSSHUB_URL}"
    fi
fi

# --- AI Configuration ---
echo ""
echo "🤖 AI Support Configuration"
echo "Enabling AI support provides better search results and content recommendations."
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

# --- Admin User Configuration ---
echo ""
echo "👤 Admin User Setup"
echo "Create a default admin user for your Readspace instance."
echo ""
read -p "Admin email: " ADMIN_EMAIL
while [[ ! "$ADMIN_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; do
    echo "❌ Please enter a valid email address."
    read -p "Admin email: " ADMIN_EMAIL
done

read -s -p "Admin password: " ADMIN_PASSWORD
echo ""
while [ ${#ADMIN_PASSWORD} -lt 6 ]; do
    echo "❌ Password must be at least 6 characters long."
    read -s -p "Admin password: " ADMIN_PASSWORD
    echo ""
done

echo "✅ Admin user configured: $ADMIN_EMAIL"

# --- Create Admin User Migration ---
echo ""
echo "📝 Creating admin user migration..."

# Create the migration file with fixed timestamp to sort after init schema
MIGRATION_FILE="server/alembic/versions/20250829_000000_add_default_admin_user.py"

# Create the server directory if it doesn't exist
mkdir -p server/alembic/versions

cat <<EOF > "$MIGRATION_FILE"
"""add default admin user

Revision ID: $(openssl rand -hex 6)
Revises: 1fef245d6d85
Create Date: 2025-08-29 00:00:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "$(openssl rand -hex 6)"
down_revision: str | None = "1fef245d6d85"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create default admin user."""
    op.execute("""
    DO \$\$
    DECLARE
        admin_user_id UUID;
    BEGIN
        -- Check if admin user already exists
        IF EXISTS (SELECT 1 FROM auth.users WHERE email = '${ADMIN_EMAIL}') THEN
            RETURN;
        END IF;

        -- Generate user ID
        admin_user_id := gen_random_uuid();

        -- Insert into auth.users
        INSERT INTO auth.users (
            id, instance_id, role, aud, email,
            raw_app_meta_data, raw_user_meta_data,
            is_super_admin, encrypted_password,
            created_at, updated_at, last_sign_in_at,
            email_confirmed_at, confirmation_sent_at,
            confirmation_token, recovery_token,
            email_change_token_new, email_change,
            confirmed_at
        ) VALUES (
            admin_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            '${ADMIN_EMAIL}',
            '{"provider":"email","providers":["email"]}',
            json_build_object(
                'sub', admin_user_id::text,
                'email', '${ADMIN_EMAIL}',
                'display_name', 'admin',
                'email_verified', true,
                'phone_verified', false
            ),
            NULL,
            extensions.crypt('${ADMIN_PASSWORD}', extensions.gen_salt('bf', 12)),
            NOW(), NOW(), NOW(),
            NOW(), NULL,
            '', '', '', '',
            NOW()
        );

        -- Insert into auth.identities
        INSERT INTO auth.identities (
            id, provider_id, provider, user_id,
            identity_data, last_sign_in_at,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            admin_user_id::text,
            'email',
            admin_user_id,
            json_build_object(
                'sub', admin_user_id::text,
                'email', '${ADMIN_EMAIL}',
                'email_verified', true,
                'provider', 'email'
            ),
            NOW(), NOW(), NOW()
        );

        -- Set admin role if the role column exists (will be created in next migration)
        IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'profiles' AND column_name = 'role') THEN
            UPDATE profiles SET role = 'admin' WHERE id = admin_user_id;
        END IF;
    END;
    \$\$;
    """)


def downgrade() -> None:
    """Remove default admin user."""
    op.execute("""
    DO \$\$
    DECLARE
        admin_user_id UUID;
    BEGIN
        -- Get admin user ID
        SELECT id INTO admin_user_id FROM auth.users WHERE email = '${ADMIN_EMAIL}';

        IF admin_user_id IS NOT NULL THEN
            -- Delete from auth.identities first (due to foreign key)
            DELETE FROM auth.identities WHERE user_id = admin_user_id;
            -- Delete from auth.users
            DELETE FROM auth.users WHERE id = admin_user_id;
        END IF;
    END;
    \$\$;
    """)
EOF

echo "✅ Migration file created: $MIGRATION_FILE"

# --- Configuration & Input Validation ---

# Check for required command-line tools.
for cmd in openssl jq tr; do
  if ! command -v "$cmd" &> /dev/null;
  then
    echo "Error: Required command '$cmd' is not installed." >&2
    exit 1
  fi
done

# --- Port Availability Check ---
echo "🔍 Checking port availability..."

# Define the ports exposed to host
REQUIRED_PORTS=(18000 18008 18042 1200 6379)
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

# If any ports are occupied, exit with error
if [ ${#OCCUPIED_PORTS[@]} -ne 0 ]; then
  echo "❌ Error: The following required ports are already in use:" >&2
  for port in "${OCCUPIED_PORTS[@]}"; do
    echo "  - Port $port" >&2
  done
  echo "" >&2
  echo "Please free these ports before running setup:" >&2
  echo "  sudo lsof -ti:<port> | xargs kill -9" >&2
  echo "" >&2
  echo "Required ports:" >&2
  echo "  - 18000: Supabase API Gateway" >&2
  echo "  - 18008: Readspace API Server" >&2
  echo "  - 18042: Readspace Web Application" >&2
  exit 1
fi

echo "✅ All required ports are available."

# Set domain to 0.0.0.0 for local development
DOMAIN="0.0.0.0"
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
if [ ! -f "docker/supabase/.env.example" ]; then
    echo "Error: docker/supabase/.env.example not found!" >&2
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
  docker/supabase/.env.example > docker/supabase/.env
echo "✅ docker/supabase/.env created."

# --- Create apps/web/.env ---
echo "📝 Creating apps/web/.env file..."
# Create the directory if it doesn't exist
mkdir -p apps/web
cat <<EOF > apps/web/.env
# This file was auto-generated by setup.sh

# Public configuration (client-side)
NEXT_PUBLIC_API_BASE_URL=http://${API_HOST}:18008
NEXT_PUBLIC_APP_URL=http://${API_HOST}:18042
NEXT_PUBLIC_SUPABASE_URL=http://${API_HOST}:18000
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
EOF
echo "✅ apps/web/.env created."


# --- Create server/.env ---
echo "📝 Creating server/.env file..."
# Create the directory if it doesn't exist
mkdir -p server
cat <<EOF > server/.env
# This file was auto-generated by setup.sh

# Private Supabase configuration for server-side operations
SUPABASE_URL=http://${API_HOST}:18000
SUPABASE_JWT_SECRET=${JWT_SECRET}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# Full database connection string
SUPABASE_DB_CONNECTION=postgresql://postgres:${POSTGRES_PASSWORD}@${API_HOST}:5432/postgres

# AI Configuration
ENABLE_AI=${ENABLE_AI}
GEMINI_API_KEY=${GEMINI_API_KEY}
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_EMBEDDING_MODEL=text-embedding-004

# RSShub Configuration
RSSHUB_URL=${RSSHUB_URL}
EOF
echo "✅ server/.env created."

echo "------------------------------------------------"
echo "🎉 All configuration files have been generated successfully!"
echo ""
echo "📋 Summary:"
echo "  • API Host: $API_HOST"
echo "  • RSSHub URL: $RSSHUB_URL"
echo "  • AI Support: $ENABLE_AI"
echo "  • Admin User: $ADMIN_EMAIL"
echo ""
echo "Next steps:"
echo "1. Run ./start_docker.sh to start the services."
echo "2. The database migrations will automatically create your admin user."
echo "3. You can login with the admin credentials you provided."
