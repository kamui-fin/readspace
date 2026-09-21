import browser from 'webextension-polyfill'
import { supabase } from '../supabase-client'

export async function startOAuth(provider: 'google' | 'apple') {
  const providerName = provider === 'apple' ? 'Apple' : 'Google'
  const { data: authData, error: authError } =
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: browser.identity.getRedirectURL(),
        skipBrowserRedirect: true,
      },
    })

  if (authError) throw authError
  if (!authData?.url) throw new Error('No OAuth URL returned')

  let redirectUrl: string
  try {
    redirectUrl = await browser.identity.launchWebAuthFlow({
      url: authData.url,
      interactive: true,
    })
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'The browser could not complete the authorization flow'
    throw new Error(`${providerName} sign-in failed: ${reason}`)
  }

  if (!redirectUrl) {
    throw new Error('No redirect URL received from OAuth flow')
  }

  const urlObj = new URL(redirectUrl)
  const hashParams = new URLSearchParams(urlObj.hash.substring(1))
  const oauthError =
    urlObj.searchParams.get('error_description') ||
    hashParams.get('error_description') ||
    urlObj.searchParams.get('error') ||
    hashParams.get('error')
  if (oauthError) throw new Error(oauthError)

  // Check for code (PKCE)
  const code = urlObj.searchParams.get('code')
  if (code) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.exchangeCodeForSession(code)
    if (sessionError) throw sessionError
    return sessionData
  }

  // Check for access_token (Implicit)
  const access_token = hashParams.get('access_token')
  const refresh_token = hashParams.get('refresh_token')

  if (access_token && refresh_token) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
    if (sessionError) throw sessionError
    return sessionData
  }

  throw new Error('Failed to retrieve session from OAuth redirect')
}
