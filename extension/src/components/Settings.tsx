import React, { useState } from 'react'
import { useExtensionStore } from '@/store'
import { resetSupabaseClient } from '@/lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { ArrowLeft, LogOut, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface SettingsProps {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps) {
  const { settings, user, updateSettings, logout } = useExtensionStore()
  const [readspaceUrl, setReadspaceUrl] = useState(settings.readspace_url)
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabase_url)
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabase_anon_key)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!readspaceUrl.trim() || !supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSaving(true)
    const toastId = toast.loading('Saving settings...')
    
    try {
      await updateSettings({ 
        readspace_url: readspaceUrl.trim(),
        supabase_url: supabaseUrl.trim(),
        supabase_anon_key: supabaseAnonKey.trim()
      })
      
      // Reset Supabase client to use new settings
      resetSupabaseClient()
      
      toast.success('Settings saved successfully!', { id: toastId })
      onBack()
    } catch (error) {
      console.error('Failed to save settings:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings'
      toast.error(errorMessage, { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    toast.success('Successfully signed out')
    onBack()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold">Settings</h2>
      </div>

      {/* User Info */}
      {user && (
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm">
            <p className="font-medium">Logged in as</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {user && (
        <div className="space-y-3">
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-full"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      )}

      {/* Advanced Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pt-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold">Advanced</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="readspaceUrl">Readspace Server URL</Label>
            <Input
              id="readspaceUrl"
              type="url"
              placeholder="http://0.0.0.0:8008"
              value={readspaceUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReadspaceUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The URL where your self-hosted Readspace server is running.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabaseUrl">Supabase URL</Label>
            <Input
              id="supabaseUrl"
              type="url"
              placeholder="http://localhost:54321"
              value={supabaseUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupabaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your Supabase project URL (for self-hosted setups only).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabaseAnonKey">Supabase Anonymous Key</Label>
            <Input
              id="supabaseAnonKey"
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseAnonKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupabaseAnonKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your Supabase anonymous key (for self-hosted setups only).
            </p>
          </div>

          <Button onClick={handleSave} className="w-full" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Advanced Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
} 