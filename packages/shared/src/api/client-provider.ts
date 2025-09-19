import type { ApiClient } from "./client";

/**
 * Type for the API client interface that hooks will use.
 * This allows different platforms to provide their own implementation.
 */
export type ApiClientInterface = typeof ApiClient;

/**
 * Global client provider that stores the current API client implementation.
 * This allows different platforms (web, extension) to inject their own clients.
 */
class ClientProvider {
  private static instance: ApiClientInterface | null = null;

  /**
   * Register an API client implementation for use by all hooks.
   * This should be called once during app initialization.
   */
  static setClient(client: ApiClientInterface): void {
    this.instance = client;
  }

  /**
   * Get the current API client implementation.
   * Throws an error if no client has been registered.
   */
  static getClient(): ApiClientInterface {
    if (!this.instance) {
      throw new Error(
        "No API client has been registered. Call ClientProvider.setClient() during app initialization."
      );
    }
    return this.instance;
  }

  /**
   * Check if a client has been registered.
   */
  static hasClient(): boolean {
    return this.instance !== null;
  }

  /**
   * Reset the client provider (useful for testing).
   */
  static reset(): void {
    this.instance = null;
  }
}

export { ClientProvider };