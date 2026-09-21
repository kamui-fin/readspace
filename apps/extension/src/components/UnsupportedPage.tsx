import { AlertTriangle } from 'lucide-react'

interface UnsupportedPageProps {
  currentUrl?: string
}

export function UnsupportedPage({ currentUrl }: UnsupportedPageProps) {
  return (
    <div className="w-[450px] min-h-[500px] p-6 flex items-center justify-center">
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
          {currentUrl && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                Current page:{' '}
                <span className="font-mono text-xs">
                  {currentUrl.length > 50
                    ? `${currentUrl.substring(0, 50)}...`
                    : currentUrl}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
