import { useState } from 'react'
import { useExtensionStore } from '@/store'
import { Button } from './ui/button'
import { ArrowLeft, LogOut, Cloud, Server } from 'lucide-react'
import toast from 'react-hot-toast'
import { SelfHostedSettings } from './SelfHostedSettings'

interface SettingsProps {
  onBack: () => void
}

const PRODUCTION_DEFAULTS = {
  readspace_url: 'https://api.readspace.ai',
  supabase_url: 'https://hnqyngkyugiamvlhqoaf.supabase.co',
  supabase_anon_key:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs',
}

export function Settings({ onBack }: SettingsProps) {
  const { settings, user, logout } = useExtensionStore()
  const [showSelfHosted, setShowSelfHosted] = useState(false)

  // Check if using production settings
  const isUsingProduction =
    settings.readspace_url === PRODUCTION_DEFAULTS.readspace_url &&
    settings.supabase_url === PRODUCTION_DEFAULTS.supabase_url &&
    settings.supabase_anon_key === PRODUCTION_DEFAULTS.supabase_anon_key

  const handleLogout = () => {
    logout()
    toast.success('Successfully signed out')
    onBack()
  }

  // Show self-hosted settings screen
  if (showSelfHosted) {
    return <SelfHostedSettings onBack={() => setShowSelfHosted(false)} />
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

      {/* User Info */}
      {user && (
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm space-y-1">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      )}

      {/* Connection Status Card */}
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isUsingProduction ? (
                <>
                  <Cloud className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="font-medium text-sm">Readspace Cloud</span>
                </>
              ) : (
                <>
                  <Server className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="font-medium text-sm">Self-Hosted</span>
                </>
              )}
            </div>
            {!isUsingProduction && (
              <div className="text-xs text-muted-foreground font-mono truncate pl-6">
                {settings.readspace_url}
              </div>
            )}
          </div>
          <Button size="sm" onClick={() => setShowSelfHosted(true)}>
            Modify
          </Button>
        </div>
      </div>
    </div>
  )
}
