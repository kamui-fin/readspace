import { useState } from 'react'
import { useExtensionStore } from '@/store'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { ArrowLeft, Cloud, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { PRODUCTION_DEFAULTS } from '@/lib/constants'

interface SelfHostedSettingsProps {
  onBack: () => void
}

interface ConfigResponse {
  supabase_url: string
  supabase_anon_key: string
  meilisearch_url: string
  meilisearch_search_key: string
}

export function SelfHostedSettings({ onBack }: SelfHostedSettingsProps) {
  const { settings, updateSettings } = useExtensionStore()
  const [apiUrl, setApiUrl] = useState(
    settings.readspace_url === PRODUCTION_DEFAULTS.readspace_url
      ? ''
      : settings.readspace_url
  )
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string>('')

  const isUsingProduction =
    settings.readspace_url === PRODUCTION_DEFAULTS.readspace_url

  const isValid = apiUrl.trim().length > 0

  const handleSave = async () => {
    setIsValidating(true)
    setError('')
    const toastId = toast.loading('Connecting to server...')

    try {
      const trimmedUrl = apiUrl.trim()

      // Validate URL format
      try {
        new URL(trimmedUrl)
      } catch {
        throw new Error('Please enter a valid URL (e.g., http://localhost:8008)')
      }

      // Fetch config from server
      const configResponse = await fetch(`${trimmedUrl}/api/config`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!configResponse.ok) {
        if (configResponse.status === 404) {
          throw new Error('Server endpoint not found (404). Verify the server URL is correct.')
        } else if (configResponse.status >= 500) {
          throw new Error(
            `Server error (${configResponse.status}). The Readspace server may be down.`
          )
        }
        throw new Error(`Server returned error status ${configResponse.status}`)
      }

      const config: ConfigResponse = await configResponse.json()

      if (!config.supabase_url || !config.supabase_anon_key) {
        throw new Error('Server configuration is incomplete (missing Supabase credentials).')
      }

      // Update settings with fetched config
      updateSettings({
        readspace_url: trimmedUrl,
        supabase_url: config.supabase_url,
        supabase_anon_key: config.supabase_anon_key,
      })

      toast.success('Connected successfully!', { id: toastId })
      onBack()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to server'
      setError(errorMessage)
      toast.error(errorMessage, { id: toastId })
    } finally {
      setIsValidating(false)
    }
  }

  const handleUseCloudConfig = () => {
    setApiUrl('')
    updateSettings(PRODUCTION_DEFAULTS)
    toast.success('Switched to Readspace Cloud')
    onBack()
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold">Server connection</h2>
      </div>

      {/* Current mode */}
      <div className="p-3 bg-muted rounded-lg text-sm">
        <p className="text-muted-foreground">
          {isUsingProduction ? (
            <>Connected to <span className="font-medium">Readspace Cloud</span></>
          ) : (
            <>Self-hosted: <span className="font-mono text-xs break-all">{settings.readspace_url}</span></>
          )}
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4 px-1">
        <div className="space-y-2">
          <Label htmlFor="apiUrl">{isUsingProduction ? 'Self-host URL' : 'Server URL'}</Label>
          <Input
            id="apiUrl"
            type="url"
            placeholder="Server URL"
            value={apiUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setApiUrl(e.target.value)
              setError('')
            }}
            disabled={isValidating}
            className={error ? 'border-red-500' : ''}
          />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {isUsingProduction ? (
          <Button
            onClick={handleSave}
            className="w-full"
            disabled={!isValid || isValidating}
          >
            {isValidating ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Switch to Self-Hosted'
            )}
          </Button>
        ) : (
          <>
            <Button
              onClick={handleSave}
              className="w-full"
              disabled={!isValid || isValidating}
            >
              {isValidating ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Server URL'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleUseCloudConfig}
              className="w-full"
              disabled={isValidating}
            >
              <Cloud className="w-4 h-4 mr-2" />
              Switch to Cloud
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
