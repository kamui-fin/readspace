import React, { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useExtensionStore } from '@/store'
import { getSupabaseClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

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

  return (
    <div className="space-y-4">
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
