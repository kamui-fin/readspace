import React, { useState } from 'react'
import { useExtensionStore } from '@/store'
import { resetSupabaseClient } from '@/lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { ArrowLeft, LogOut, AlertTriangle, Cloud, Server } from 'lucide-react'
import toast from 'react-hot-toast'

interface SettingsProps {
  onBack: () => void
}

const PRODUCTION_DEFAULTS = {
  readspace_url: 'https://api.readspace.ai',
  readspace_app_url: 'https://app.readspace.ai',
  supabase_url: 'https://hnqyngkyugiamvlhqoaf.supabase.co',
  supabase_anon_key:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs',
}

export function Settings({ onBack }: SettingsProps) {
  const { settings, user, updateSettings, logout } = useExtensionStore()
  const [readspaceUrl, setReadspaceUrl] = useState(
    settings.readspace_url === PRODUCTION_DEFAULTS.readspace_url
      ? ''
      : settings.readspace_url
  )
  const [supabaseUrl, setSupabaseUrl] = useState(
    settings.supabase_url === PRODUCTION_DEFAULTS.supabase_url
      ? ''
      : settings.supabase_url
  )
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    settings.supabase_anon_key === PRODUCTION_DEFAULTS.supabase_anon_key
      ? ''
      : settings.supabase_anon_key
  )
  const [isSaving, setIsSaving] = useState(false)

  // Check if using production settings
  const isUsingProduction =
    settings.readspace_url === PRODUCTION_DEFAULTS.readspace_url &&
    settings.supabase_url === PRODUCTION_DEFAULTS.supabase_url &&
    settings.supabase_anon_key === PRODUCTION_DEFAULTS.supabase_anon_key

  const handleSave = async () => {
    setIsSaving(true)
    const toastId = toast.loading('Saving settings...')

    try {
      // Check if user is trying to configure self-hosted settings
      const hasAnyCustomField =
        readspaceUrl.trim() || supabaseUrl.trim() || supabaseAnonKey.trim()

      // If any field is filled (indicating self-hosted setup), all 3 fields are required
      if (hasAnyCustomField) {
        if (
          !readspaceUrl.trim() ||
          !supabaseUrl.trim() ||
          !supabaseAnonKey.trim()
        ) {
          toast.error(
            'For self-hosted configuration, all 3 fields are required',
            { id: toastId }
          )
          setIsSaving(false)
          return
        }
      }

      // Use production defaults if fields are empty, otherwise use custom values
      const finalSettings = {
        readspace_url: readspaceUrl.trim() || PRODUCTION_DEFAULTS.readspace_url,
        supabase_url: supabaseUrl.trim() || PRODUCTION_DEFAULTS.supabase_url,
        supabase_anon_key:
          supabaseAnonKey.trim() || PRODUCTION_DEFAULTS.supabase_anon_key,
      }

      // Check if switching from cloud to self-hosted or vice versa
      const switchingToSelfHosted =
        isUsingProduction &&
        (finalSettings.readspace_url !== PRODUCTION_DEFAULTS.readspace_url ||
          finalSettings.supabase_url !== PRODUCTION_DEFAULTS.supabase_url ||
          finalSettings.supabase_anon_key !==
            PRODUCTION_DEFAULTS.supabase_anon_key)

      const switchingToCloud =
        !isUsingProduction &&
        finalSettings.readspace_url === PRODUCTION_DEFAULTS.readspace_url &&
        finalSettings.supabase_url === PRODUCTION_DEFAULTS.supabase_url &&
        finalSettings.supabase_anon_key ===
          PRODUCTION_DEFAULTS.supabase_anon_key

      // If user is authenticated and switching configurations, log them out first
      if (user && (switchingToSelfHosted || switchingToCloud)) {
        console.log('Configuration change detected, signing out user...')
        logout()
      }

      await updateSettings(finalSettings)

      // Reset Supabase client to use new settings
      resetSupabaseClient()

      if (switchingToSelfHosted || switchingToCloud) {
        toast.success('Settings saved! Please sign in again.', { id: toastId })
      } else {
        toast.success('Settings saved successfully!', { id: toastId })
      }
      onBack()
    } catch (error) {
      console.error('Failed to save settings:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save settings'
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

  const handleUseCloudConfig = async () => {
    setIsSaving(true)
    const toastId = toast.loading('Switching to Readspace Cloud...')

    try {
      // If user is authenticated with self-hosted, log them out first
      if (user && !isUsingProduction) {
        console.log('Switching to cloud config, signing out user...')
        logout()
      }

      // Reset to production defaults (empty the form fields)
      setReadspaceUrl('')
      setSupabaseUrl('')
      setSupabaseAnonKey('')

      await updateSettings(PRODUCTION_DEFAULTS)

      // Reset Supabase client to use new settings
      resetSupabaseClient()

      toast.success('Switched to Readspace Cloud! Please sign in.', {
        id: toastId,
      })
      onBack()
    } catch (error) {
      console.error('Failed to switch to cloud config:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to switch to cloud config'
      toast.error(errorMessage, { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
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

      {/* Connection Status */}
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          {isUsingProduction ? (
            <>
              <Cloud className="w-4 h-4 text-green-600" />
              <span className="font-medium text-sm">
                Connected to Readspace Cloud
              </span>
              <Badge variant="secondary" className="text-xs">
                Official
              </Badge>
            </>
          ) : (
            <>
              <Server className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-sm">
                Using Self-Hosted Server
              </span>
              <Badge variant="outline" className="text-xs">
                Custom
              </Badge>
            </>
          )}
        </div>
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
          <h3 className="text-lg font-semibold">Self-Hosted Configuration</h3>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Leave empty to use official Readspace. Don't modify unless you know
            what you're doing.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="readspaceUrl">Server URL</Label>
            <Input
              id="readspaceUrl"
              type="url"
              placeholder="http://localhost:8008"
              value={readspaceUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setReadspaceUrl(e.target.value)
              }
              className="w-full text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabaseUrl">Supabase URL</Label>
            <Input
              id="supabaseUrl"
              type="url"
              placeholder="http://localhost:8000"
              value={supabaseUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSupabaseUrl(e.target.value)
              }
              className="w-full text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabaseAnonKey">Supabase Anonymous Key</Label>
            <Input
              id="supabaseAnonKey"
              type="password"
              placeholder="Your Supabase anon key"
              value={supabaseAnonKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSupabaseAnonKey(e.target.value)
              }
              className="w-full text-sm"
            />
          </div>

          <div className="space-y-2">
            <Button onClick={handleSave} className="w-full" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>

            {!isUsingProduction && (
              <Button
                variant="outline"
                onClick={handleUseCloudConfig}
                className="w-full"
                disabled={isSaving}
              >
                <Cloud className="w-4 h-4 mr-2" />
                Use Readspace Cloud
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
