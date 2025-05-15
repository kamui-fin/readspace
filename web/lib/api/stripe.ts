import { env } from "@/env" // Import validated env
import { StripeSubCache } from "@/types/stripe" // Adjust path if necessary
import { ApiClient } from "./client"

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000" // Use validated env

/**
 * Represents the response structure for the create checkout session endpoint.
 */
interface CreateCheckoutResponse {
    checkout_url: string
}

/**
 * Represents the response structure for the sync subscription endpoint.
 */
interface SyncSubscriptionResponse {
    status: string
    message?: string
    data?: StripeSubCache
}

/**
 * Helper function to make authenticated fetch requests.
 * @param url - The URL endpoint (relative to API_BASE_URL).
 * @param options - Fetch options.
 * @returns The JSON response.
 * @throws Error if fetch fails or response is not ok.
 */
const fetchAuthenticated = async <T>(
    url: string,
    options: RequestInit = {}
): Promise<T> => {
    const headers = await ApiClient.getAuthHeaders()

    const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
    })

    if (!response.ok) {
        let errorDetail = `HTTP error ${response.status}: ${response.statusText}`
        try {
            const errorBody = await response.json()
            errorDetail = errorBody.detail || errorDetail
        } catch (e) {
            // Ignore if response is not JSON
        }
        throw new Error(errorDetail)
    }

    // Handle cases where response might be empty (e.g., 200 OK with no body)
    const contentType = response.headers.get("content-type")
    if (
        response.status === 204 ||
        !contentType ||
        !contentType.includes("application/json")
    ) {
        // Return an empty object or null if appropriate for a 'no content' response
        return {} as T // Adjust if null or other value is more suitable
    }

    return response.json()
}

/**
 * Calls the backend to create a Stripe Checkout Session.
 * @param priceId - The Stripe Price ID (e.g., 'beta_pro_monthly').
 * @returns The checkout URL.
 */
export const createCheckoutSession = async (
    priceId: string
): Promise<string> => {
    const response = await fetchAuthenticated<CreateCheckoutResponse>(
        "/stripe/create-checkout-session",
        {
            method: "POST",
            body: JSON.stringify({ price_id: priceId }),
        }
    )
    if (!response.checkout_url) {
        throw new Error("Checkout URL not found in response.")
    }
    return response.checkout_url
}

/**
 * Calls the backend to sync the subscription status after successful checkout.
 * @returns The sync status response.
 */
export const syncSubscription = async (): Promise<SyncSubscriptionResponse> => {
    return fetchAuthenticated<SyncSubscriptionResponse>(
        "/stripe/sync-subscription",
        {
            method: "POST",
            // No body needed for this request based on backend implementation
        }
    )
}

/**
 * Calls the backend to get the current cached subscription status.
 * @returns The cached subscription data (StripeSubCache).
 */
export const getSubscriptionStatus = async (): Promise<StripeSubCache> => {
    return fetchAuthenticated<StripeSubCache>(
        "/stripe/subscription-status", // GET is default
        { cache: "no-store" } // Ensure fresh data is fetched, not cached by Next.js fetch
    )
}

/**
 * Represents the response structure for the create customer portal session endpoint.
 */
interface CreatePortalSessionResponse {
    portal_url: string
}

/**
 * Calls the backend to create a Stripe Customer Portal Session.
 * @param returnUrl - The URL to redirect the user back to after they finish using the portal.
 * @returns The portal session URL.
 */
export const createCustomerPortalSession = async (
    returnUrl: string
): Promise<string> => {
    const response = await fetchAuthenticated<CreatePortalSessionResponse>(
        "/stripe/create-customer-portal-session",
        {
            method: "POST",
            body: JSON.stringify({ return_url: returnUrl }),
        }
    )
    if (!response.portal_url) {
        throw new Error("Portal URL not found in response.")
    }
    return response.portal_url
}
