import { ApiClient } from '@readspace/shared';

// Export the dynamic configuration function
export { configureApiClient } from './config';

// Export the configured ApiClient
// The client is configured dynamically via config.ts based on settings store
export { ApiClient };
