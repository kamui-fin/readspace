import { sendMessage } from '@/shared/messaging'
import { useExtensionStore } from '@/store'
import { useIsCloudProd } from '@/hooks/use-is-cloud-prod'
import { Loader2 } from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import type { Session } from '@supabase/supabase-js'

interface LoginFormProps {
  onShowSelfHosted?: () => void
}

export function LoginForm({ onShowSelfHosted }: LoginFormProps = {}) {
  const { login, isConnecting } = useExtensionStore()
  const isCloudProd = useIsCloudProd()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [oauthProvider, setOAuthProvider] = useState<'google' | 'apple' | null>(
    null
  )
  const isBusy = isConnecting || oauthProvider !== null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      const errorMsg = 'Please enter both email and password'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    const toastId = toast.loading('Signing in...')

    try {
      // Send message to background script to handle login
      const { data, error: authError } = await sendMessage({
        type: 'login',
        payload: {
          email: email.trim(),
          password: password.trim(),
        },
      })

      if (authError) {
        throw new Error(authError.message)
      }

      if (!data?.session) {
        throw new Error('No session returned')
      }

      // Login to the extension store (token is already in storage)
      await login()
      toast.success('Successfully signed in!', { id: toastId })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to sign in'
      setError(errorMessage)
      toast.error(errorMessage, { id: toastId })
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    if (isBusy) return
    const providerName = provider === 'apple' ? 'Apple' : 'Google'
    setOAuthProvider(provider)
    const toastId = toast.loading(`Signing in with ${providerName}...`)

    try {
      // Send message to background script to handle OAuth flow
      // This ensures the flow completes even if the popup closes

      const data = await sendMessage<{ session: Session | null }>({
        type: provider === 'apple' ? 'startAppleOAuth' : 'startGoogleOAuth',
      })

      if (!data?.session) {
        throw new Error(`Failed to authenticate with ${providerName}`)
      }

      // Login to the extension store (token is already in storage)
      await login()
      toast.success(`Successfully signed in with ${providerName}!`, {
        id: toastId,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to sign in with ${providerName}`
      toast.error(errorMessage, { id: toastId })
      console.error(`${providerName} sign-in error:`, error)
    } finally {
      setOAuthProvider(null)
    }
  }

  return (
    <div className="space-y-4">
      {isCloudProd && (
        <>
          {/* Google OAuth Button */}
          <Button
            variant="outline"
            className="w-full h-12"
            type="button"
            onClick={() => handleOAuthSignIn('google')}
            disabled={isBusy}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="mr-2 h-4 w-4"
            >
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            {oauthProvider === 'google' ? 'Signing in…' : 'Login with Google'}
          </Button>

          <Button
            variant="outline"
            className="w-full h-12"
            type="button"
            onClick={() => handleOAuthSignIn('apple')}
            disabled={isBusy}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="mr-2 h-4 w-4"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.828-1.207.052-2.662.805-3.532 1.816-.78.895-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z"
              />
            </svg>
            {oauthProvider === 'apple' ? 'Signing in…' : 'Login with Apple'}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted-foreground/20" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
        </>
      )}

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            disabled={isBusy}
            required
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPassword(e.target.value)
            }
            disabled={isBusy}
            required
            className="h-12"
          />
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={isBusy || !email.trim() || !password.trim()}
          className="w-full h-12"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      {/* Self-hosted link */}
      {onShowSelfHosted && (
        <div className="text-center pt-2">
          <button
            onClick={onShowSelfHosted}
            className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            {isCloudProd ? 'Using a self-hosted server?' : 'Change server'}
          </button>
        </div>
      )}
    </div>
  )
}
