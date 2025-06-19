#!/bin/bash

set -e

cp .env.example .env

# Detect OS and set sed flags accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS (BSD sed)
    SED_INPLACE="sed -i ''"
else
    # Linux (GNU sed)
    SED_INPLACE="sed -i"
fi

# Generate secure secrets
JWT_SECRET=$(openssl rand -hex 32)
SERVICE_ROLE_KEY=$(openssl rand -hex 32)
ANON_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
DASHBOARD_USERNAME="admin"
DASHBOARD_PASSWORD=$(openssl rand -hex 12)
SECRET_KEY_BASE=$(openssl rand -base64 48 | tr -d '=+/[:space:]' | cut -c1-64)
VAULT_ENC_KEY=$(openssl rand -hex 16)
LOGFLARE_API_KEY=$(openssl rand -hex 32)

# Replace the values in the .env file
$SED_INPLACE "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" .env
$SED_INPLACE "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
$SED_INPLACE "s|^ANON_KEY=.*|ANON_KEY=$ANON_KEY|" .env
$SED_INPLACE "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY|" .env
$SED_INPLACE "s|^DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=$DASHBOARD_USERNAME|" .env
$SED_INPLACE "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD|" .env
$SED_INPLACE "s|^SECRET_KEY_BASE=.*|SECRET_KEY_BASE=$SECRET_KEY_BASE|" .env
$SED_INPLACE "s|^VAULT_ENC_KEY=.*|VAULT_ENC_KEY=$VAULT_ENC_KEY|" .env
$SED_INPLACE "s|^LOGFLARE_LOGGER_BACKEND_API_KEY=.*|LOGFLARE_LOGGER_BACKEND_API_KEY=$LOGFLARE_API_KEY|" .env
$SED_INPLACE "s|^LOGFLARE_API_KEY=.*|LOGFLARE_API_KEY=$LOGFLARE_API_KEY|" .env

# Print results
echo "✅ .env secrets successfully updated."
echo
echo "🔑 Generated Secrets:"
echo "---------------------"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "JWT_SECRET=$JWT_SECRET"
echo "ANON_KEY=$ANON_KEY"
echo "SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo "DASHBOARD_USERNAME=$DASHBOARD_USERNAME"
echo "DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD"
echo "SECRET_KEY_BASE=$SECRET_KEY_BASE"
echo "VAULT_ENC_KEY=$VAULT_ENC_KEY"
echo "LOGFLARE_API_KEY=$LOGFLARE_API_KEY"
echo
