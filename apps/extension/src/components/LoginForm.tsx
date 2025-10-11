import React, { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useExtensionStore } from '@/store'
import { getSupabaseClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { browser, identity } from '@/lib/browser'

export function LoginForm() {
  const { login, isConnecting, settings } = useExtensionStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      const errorMsg = 'Please enter both email and password'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    if (!settings.supabase_url || !settings.supabase_anon_key) {
      const errorMsg =
        'Supabase configuration is missing. Please check settings.'
      setError(errorMsg)
      toast.error(errorMsg)
      return
    }

    const toastId = toast.loading('Signing in...')

    try {
      const supabase = getSupabaseClient(
        settings.supabase_url,
        settings.supabase_anon_key
      )

      if (!supabase) {
        throw new Error('Failed to initialize Supabase client')
      }

      const { data, error: signinError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        })

      if (signinError) {
        throw new Error(signinError.message)
      }

      if (!data.session?.access_token) {
        throw new Error('No access token received')
      }

      // Login to the extension store with the access token
      await login(data.session.access_token)
      toast.success('Successfully signed in!', { id: toastId })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to sign in'
      setError(errorMessage)
      toast.error(errorMessage, { id: toastId })
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      if (!settings.supabase_url || !settings.supabase_anon_key) {
        const errorMsg =
          'Supabase configuration is missing. Please check settings.'
        toast.error(errorMsg)
        return
      }

      const supabase = getSupabaseClient(
        settings.supabase_url,
        settings.supabase_anon_key
      )

      if (!supabase) {
        throw new Error('Failed to initialize Supabase client')
      }

      // Get the extension's OAuth redirect URL
      const redirectTo = identity.getRedirectURL()

      // Initiate OAuth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })

      if (error) throw error

      // Open OAuth URL in new tab - background script will handle the callback
      await browser.tabs.create({ url: data.url })
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to login with Google. Please try again.'

      // Provide specific error messages for Google OAuth
      if (errorMessage.includes('popup_closed_by_user')) {
        toast.error(
          'Login cancelled. Please try again if you want to sign in with Google.'
        )
      } else if (errorMessage.includes('access_denied')) {
        toast.error(
          'Access denied. Please grant permission to continue with Google login.'
        )
      } else {
        toast.error(errorMessage)
      }
      console.error('Google sign-in error:', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* Google OAuth Button */}
      <Button
        variant="outline"
        className="w-full h-12"
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isConnecting}
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
        Login with Google
      </Button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

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
            disabled={isConnecting}
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
            disabled={isConnecting}
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
          disabled={isConnecting || !email.trim() || !password.trim()}
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
    </div>
  )
}
