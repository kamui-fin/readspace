import browser from 'webextension-polyfill'
import type { PageMetadata } from '@readspace/shared'
import { ExternalLink, LogOut } from 'lucide-react'
import { ArticlePreview } from './ArticlePreview'
import { FeedDiscoveryCard } from './FeedDiscoveryCard'
import ThemeSwitcher from './ThemeSwitcher'
import { Button } from './ui/button'
import toast from 'react-hot-toast'

interface MainViewProps {
  onOpenReadspace: () => void
  onLogout: () => Promise<void>
  isSelfHosted: boolean
  isFeedDataLoading: boolean
  currentPageMetadata: PageMetadata | null
  isMetadataLoading: boolean
  readingTime?: number
  currentUrl?: string
}

export function MainView({
  onOpenReadspace,
  onLogout,
  isSelfHosted,
  isFeedDataLoading,
  currentPageMetadata,
  isMetadataLoading,
  readingTime,
  currentUrl,
}: MainViewProps) {
  const handleLogout = async () => {
    try {
      await onLogout()
      toast.success('Signed out')
    } catch {
      toast.error('Failed to sign out')
    }
  }
  return (
    <div className="w-[450px] min-h-[500px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5">
            <img
              src={browser.runtime.getURL('assets/readspace.svg')}
              alt="Readspace"
              className="w-full h-full"
            />
          </div>
          <h1
            className="font-semibold text-lg"
            style={{ fontFamily: 'Figtree' }}
          >
            readspace
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {!isSelfHosted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenReadspace}
              className="h-8 w-8 p-0"
              title="Open Readspace"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 w-8 p-0"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* RSS Feed Discovery Card - Show skeleton while loading or if feeds exist */}
        {(isFeedDataLoading ||
          (currentPageMetadata?.feeds &&
            currentPageMetadata.feeds.length > 0)) && (
          <FeedDiscoveryCard
            feeds={currentPageMetadata?.feeds}
            websiteTitle={currentPageMetadata?.title}
            isLoading={isFeedDataLoading}
          />
        )}

        {/* Current Page Preview - Always show, with skeleton while loading */}
        <ArticlePreview
          metadata={currentPageMetadata || undefined}
          isMetadataLoading={isMetadataLoading}
          readingTime={readingTime}
          currentUrl={currentUrl}
        />
      </div>
    </div>
  )
}
