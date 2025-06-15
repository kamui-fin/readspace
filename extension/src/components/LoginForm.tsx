import React, { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useExtensionStore } from '@/store'
import { getSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface LoginFormProps {
  onBack: () => void
}

export function LoginForm({ onBack }: LoginFormProps) {
  const { login, isConnecting } = useExtensionStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password')
      return
    }

    try {
      const supabase = getSupabaseClient()
      
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (authError) {
        throw new Error(authError.message)
      }

      if (!data.session?.access_token) {
        throw new Error('No access token received')
      }

      // Login to the extension store with the access token
      await login(data.session.access_token)
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sign in')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold">Sign In</h2>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>Sign in to your Readspace account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              disabled={isConnecting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              disabled={isConnecting}
              required
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isConnecting || !email.trim() || !password.trim()}
            className="w-full"
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

        <div className="text-xs text-muted-foreground">
          <p>
            Your credentials are handled securely by Supabase and only used to
            authenticate with your Readspace instance.
          </p>
        </div>
      </div>
    </div>
  )
} 