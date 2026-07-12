import { toast } from '@components/ui/toast';
import { useCallback } from 'react';

interface SupabaseError {
  message?: string;
  status?: number;
  code?: string;
  error_description?: string;
}

/**
 * Auth error types mapped to user-friendly messages
 */
const AUTH_ERROR_MESSAGES: Record<string, { signin: string; signup: string }> = {
  // Supabase-specific error codes
  invalid_credentials: {
    signin: 'Incorrect email or password. Please try again.',
    signup: 'Invalid credentials provided.',
  },
  email_not_confirmed: {
    signin: 'Please verify your email address before signing in.',
    signup: 'Email verification required.',
  },
  user_not_found: {
    signin: 'No account found with this email. Sign up instead?',
    signup: 'Account not found.',
  },
  user_already_exists: {
    signin: 'This account already exists.',
    signup: 'This email is already registered.',
  },
  weak_password: {
    signin: 'Password is too weak.',
    signup: 'Password must be at least 8 characters with numbers and letters.',
  },
  invalid_email: {
    signin: 'Invalid email address. Please check and try again.',
    signup: 'Invalid email address. Please check and try again.',
  },
  rate_limit_exceeded: {
    signin: 'Too many attempts. Please try again in a few minutes.',
    signup: 'Too many attempts. Please try again in a few minutes.',
  },
  network_error: {
    signin: 'Network error. Please check your connection and try again.',
    signup: 'Network error. Please check your connection and try again.',
  },
  timeout: {
    signin: 'Request timed out. Please try again.',
    signup: 'Request timed out. Please try again.',
  },
  unauthorized: {
    signin: 'Access denied. Please check your credentials.',
    signup: 'Access denied.',
  },
  oauth_user: {
    signin: 'This account uses Google sign-in. Please use the Sign in with Google option instead.',
    signup: 'This account uses Google sign-in. Please use the Sign in with Google option instead.',
  },
};

/**
 * Keyword patterns to match error messages to error types
 */
const ERROR_PATTERNS: Record<string, string[]> = {
  invalid_credentials: [
    'invalid login credentials',
    'invalid password',
    'incorrect password',
    'wrong password',
  ],
  email_not_confirmed: [
    'email not confirmed',
    'email not verified',
    'verify your email',
    'confirmation required',
  ],
  user_not_found: ['user not found', 'no user found', 'user does not exist', 'account not found'],
  user_already_exists: [
    'user already registered',
    'user already exists',
    'email already in use',
    'email already registered',
    'duplicate',
    'already registered',
  ],
  weak_password: [
    'weak password',
    'password is too weak',
    'password too short',
    'password strength',
  ],
  invalid_email: ['invalid email', 'email is invalid', 'malformed email', 'email format'],
  rate_limit_exceeded: ['too many requests', 'rate limit', 'too many attempts', 'rate exceeded'],
  network_error: [
    'network',
    'connection',
    'fetch failed',
    'network request failed',
    'failed to fetch',
  ],
  timeout: ['timeout', 'timed out', 'request timeout'],
  unauthorized: ['unauthorized', 'forbidden', '401', '403'],
  oauth_user: [
    'oauth',
    'identity provider',
    'provider token',
    'not a password-based account',
    'email provider is not enabled',
  ],
};

/**
 * Determines the error type from a Supabase error or error message
 */
function getErrorType(error: unknown): string | null {
  // Check if it's a Supabase error with a code
  if (typeof error === 'object' && error !== null) {
    const supabaseError = error as SupabaseError;
    if (supabaseError.code) {
      return supabaseError.code;
    }
  }

  // Fall back to message-based pattern matching
  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Check against each pattern
  for (const [errorType, patterns] of Object.entries(ERROR_PATTERNS)) {
    if (patterns.some((pattern) => errorMessage.includes(pattern))) {
      return errorType;
    }
  }

  return null;
}

/**
 * Hook to handle authentication errors and display appropriate toast messages
 */
export function useAuthErrorHandler() {
  const handleAuthError = useCallback((error: unknown, context: 'signin' | 'signup' = 'signin') => {
    console.error(`Auth error (${context}):`, error);

    // Determine error type
    const errorType = getErrorType(error);

    // Get user-friendly message
    if (errorType && AUTH_ERROR_MESSAGES[errorType]) {
      toast.error(AUTH_ERROR_MESSAGES[errorType][context]);
      return;
    }

    // Generic fallback with original error message
    const displayMessage =
      error instanceof Error ? error.message : 'Authentication failed. Please try again.';
    toast.error(displayMessage);
  }, []);

  return { handleAuthError };
}
