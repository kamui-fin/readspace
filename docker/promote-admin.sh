#!/bin/bash

# ==============================================================================
# Promote User to Admin
#
# This script promotes an existing user to admin role in the Readspace instance.
#
# Usage:
#   ./docker/promote-admin.sh <email>
#
# Example:
#   ./docker/promote-admin.sh user@example.com
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status.

# Check if email argument is provided
if [ -z "$1" ]; then
    echo "❌ Error: Email address is required"
    echo ""
    echo "Usage: ./promote-admin.sh <email>"
    echo "Example: ./promote-admin.sh user@example.com"
    exit 1
fi

EMAIL="$1"

# Validate email format
if [[ ! "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    echo "❌ Error: Invalid email address format"
    exit 1
fi

echo "🔍 Checking if user exists..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if user exists and get their ID
USER_ID=$(docker compose -f "$SCRIPT_DIR/supabase/docker-compose.yml" exec -T db psql -U postgres -d postgres -t -c \
    "SELECT id FROM auth.users WHERE email = '$EMAIL' LIMIT 1;" | xargs)

if [ -z "$USER_ID" ]; then
    echo "❌ Error: User with email '$EMAIL' not found"
    echo ""
    echo "Please make sure:"
    echo "  1. The user has created an account"
    echo "  2. The email address is correct"
    exit 1
fi

echo "✅ User found: $USER_ID"
echo ""
echo "👑 Promoting user to admin..."

# Update user's role to admin
docker compose -f "$SCRIPT_DIR/supabase/docker-compose.yml" exec -T db psql -U postgres -d postgres -c \
    "UPDATE profiles SET role = 'admin' WHERE id = '$USER_ID';"

echo ""
echo "✅ Successfully promoted $EMAIL to admin!"
echo ""
echo "The user now has admin privileges and can access admin features."
