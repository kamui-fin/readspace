import { useState } from 'react'
import { useExtensionStore } from '@/store'
import { resetSupabaseClient } from '@/lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { ArrowLeft, Cloud, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface SelfHostedSettingsProps {
  onBack: () => void
}

const PRODUCTION_DEFAULTS = {
  readspace_url: 'https://api.readspace.ai',
  readspace_app_url: 'https://app.readspace.ai',
  supabase_url: 'https://hnqyngkyugiamvlhqoaf.supabase.co',
  supabase_anon_key:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs',
}

export function SelfHostedSettings({ onBack }: SelfHostedSettingsProps) {
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
        logout()
      }

      updateSettings(finalSettings)

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

  const handleUseCloudConfig = async () => {
    setIsSaving(true)
    const toastId = toast.loading('Switching to Readspace Cloud...')

    try {
      // If user is authenticated with self-hosted, log them out first
      if (user && !isUsingProduction) {
        logout()
      }

      // Reset to production defaults (empty the form fields)
      setReadspaceUrl('')
      setSupabaseUrl('')
      setSupabaseAnonKey('')

      updateSettings(PRODUCTION_DEFAULTS)

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
        <h2 className="text-xl font-semibold">Self-Hosted Configuration</h2>
      </div>

      {/* Warning */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Advanced Users Only
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Only modify these settings if you're self-hosting. 
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4 px-2">
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
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Your Readspace server API endpoint
          </p>
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
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Your Supabase instance URL
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supabaseAnonKey">Supabase Anonymous Key</Label>
          <Input
            id="supabaseAnonKey"
            type="text"
            placeholder="Your Supabase anon key"
            value={supabaseAnonKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSupabaseAnonKey(e.target.value)
            }
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Your Supabase anonymous/public key
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <Button onClick={handleSave} className="w-full" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </Button>

        {!isUsingProduction && (
          <Button
            variant="outline"
            onClick={handleUseCloudConfig}
            className="w-full"
            disabled={isSaving}
          >
            <Cloud className="w-4 h-4 mr-2" />
            Switch to Readspace Cloud
          </Button>
        )}
      </div>
    </div>
  )
}
