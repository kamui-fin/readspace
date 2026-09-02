import { useState } from 'react'
import { useExtensionStore } from '@/store'
import { Button } from './ui/button'
import { ArrowLeft, LogOut, Cloud, Server } from 'lucide-react'
import toast from 'react-hot-toast'
import { SelfHostedSettings } from './SelfHostedSettings'
import { PRODUCTION_DEFAULTS } from '@/lib/constants'

interface SettingsProps {
  onBack: () => void
}

export function Settings({
  onBack,
  initialShowSelfHosted = false,
}: SettingsProps & { initialShowSelfHosted?: boolean }) {
  const { settings, user, logout, updateSettings } = useExtensionStore()
  const [showSelfHosted, setShowSelfHosted] = useState(initialShowSelfHosted)

  // Check if using production settings
  const isUsingProduction =
    settings.readspace_url === PRODUCTION_DEFAULTS.readspace_url &&
    settings.supabase_url === PRODUCTION_DEFAULTS.supabase_url &&
    settings.supabase_anon_key === PRODUCTION_DEFAULTS.supabase_anon_key

  const handleLogout = async () => {
    await logout()
    toast.success('Successfully signed out')
    onBack()
  }

  const switchToCloud = () => {
    updateSettings(PRODUCTION_DEFAULTS)
    toast.success('Switched to Readspace Cloud')
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
          className="h-8 w-8 p-0 cursor-pointer"
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
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              className="cursor-pointer"
            >
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

          {isUsingProduction ? (
            <Button
              size="sm"
              onClick={() => setShowSelfHosted(true)}
              className="cursor-pointer"
            >
              Modify
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSelfHosted(true)}
                className="cursor-pointer"
              >
                Modify
              </Button>
              <Button
                size="sm"
                onClick={switchToCloud}
                className="cursor-pointer"
              >
                Switch to Cloud
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
