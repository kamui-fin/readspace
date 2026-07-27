/**
 * App Configuration Constants
 *
 * IMPORTANT: Replace the GOOGLE_WEB_CLIENT_ID with your actual Google OAuth Web Client ID
 * from the Google Cloud Console (https://console.cloud.google.com)
 *
 * To get your Web Client ID:
 * 1. Go to Google Cloud Console
 * 2. Select your project (or create one)
 * 3. Enable Google+ API
 * 4. Go to Credentials
 * 5. Create OAuth 2.0 Client ID (Web application type)
 * 6. Copy the Client ID and paste it below
 */

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '29989057291-a6reeagst1192gcjmgrqouheuq61j8ra.apps.googleusercontent.com';

/**
 * Cloud Configuration
 * These are the default values for the production cloud instance
 * Loaded from environment variables for security
 */
export const CLOUD_CONFIG = {
  READSPACE_URL:
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_CLOUD_API_URL ||
    'https://api.readspace.ai',
  READSPACE_APP_URL:
    process.env.EXPO_PUBLIC_APP_URL ||
    process.env.EXPO_PUBLIC_CLOUD_APP_URL ||
    'https://app.readspace.ai',
  SUPABASE_URL:
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_CLOUD_SUPABASE_URL ||
    'https://supabase.readspace.ai',
  SUPABASE_ANON_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_CLOUD_SUPABASE_ANON_KEY ||
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzY0MDM0MzQ2LAogICJleHAiOiAxOTIxNzE0MzQ2Cn0.s0f50HbzrOO5boLjTmCYXImtCqZrw0vjYwPXtyIZKyE',
  MEILISEARCH_URL:
    process.env.EXPO_PUBLIC_MEILISEARCH_URL ||
    process.env.EXPO_PUBLIC_CLOUD_MEILISEARCH_URL ||
    'https://search.readspace.ai',
  MEILISEARCH_SEARCH_KEY:
    process.env.EXPO_PUBLIC_MEILISEARCH_SEARCH_KEY ||
    process.env.EXPO_PUBLIC_CLOUD_MEILISEARCH_SEARCH_KEY ||
    '8ceccba3f103a1d826ac3109a149f3c1fe6d68253e395d92b59fdae0a0eaf1b5',
} as const;
