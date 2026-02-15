import { AlertTriangle } from 'lucide-react'
import { Settings } from './Settings'

interface UnsupportedPageProps {
  currentUrl?: string
  currentView: 'main' | 'settings' | 'settings-self-hosted' | 'login'
  onViewChange: (
    view: 'main' | 'settings' | 'settings-self-hosted' | 'login'
  ) => void
}

export function UnsupportedPage({
  currentUrl,
  currentView,
  onViewChange,
}: UnsupportedPageProps) {
  return (
    <div className="w-[450px] min-h-[500px] p-6">
      <div className="text-center space-y-4">
        {/* Unsupported page message */}
        <div className="space-y-3">
          <div className="flex justify-center">
            <AlertTriangle className="w-16 h-16 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold">Page Not Supported</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Readspace extension only works on websites (http:// and https://
            pages). This page type is not supported for saving articles.
          </p>
          <div className="pt-2">
            <p className="text-xs text-muted-foreground">
              Current page:{' '}
              <span className="font-mono text-xs">
                {currentUrl?.substring(0, 50)}...
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Settings overlay */}
      {currentView === 'settings' && (
        <div className="absolute inset-0 bg-background">
          <Settings onBack={() => onViewChange('main')} />
        </div>
      )}
    </div>
  )
}
