import React, { useState } from 'react'
import { useExtensionStore } from '@/store'
import { resetSupabaseClient } from '@/lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { ArrowLeft, LogOut } from 'lucide-react'

interface SettingsProps {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps) {
  const { settings, user, updateSettings, logout } = useExtensionStore()
  const [readspaceUrl, setReadspaceUrl] = useState(settings.readspace_url)
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabase_url)
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabase_anon_key)

  const handleSave = () => {
    updateSettings({ 
      readspace_url: readspaceUrl,
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey
    })
    
    // Reset Supabase client to use new settings
    resetSupabaseClient()
    
    onBack()
  }

  const handleLogout = () => {
    logout()
    onBack()
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
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      {user && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-sm">
            <p className="font-medium">{user.full_name || user.email}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="readspaceUrl">Readspace API URL</Label>
          <Input
            id="readspaceUrl"
            type="url"
            placeholder="http://0.0.0.0:8008"
            value={readspaceUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReadspaceUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enter the URL of your Readspace API server.
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
            Your Supabase project URL for authentication.
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
            Your Supabase anonymous/public key (safe to store in client).
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            Save Settings
          </Button>
        </div>

        {user && (
          <div className="pt-4 border-t">
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
      </div>
    </div>
  )
} 