import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LoginView } from './components/LoginView'
import { MainView } from './components/MainView'
import { ThemedToaster } from './components/ThemedToaster'
import { UnsupportedPage } from './components/UnsupportedPage'
import { useCurrentPage } from './hooks/use-current-page'
import './index.css'
import { useExtensionStore } from './store'
import { PRODUCTION_DEFAULTS } from '@/lib/constants'

function PopupContent() {
  const { isAuthenticated, settings, checkExistingSession, logout } =
    useExtensionStore()

  const {
    currentTab,
    currentPageMetadata,
    readingTime,
    isUnsupportedPage,
    isMetadataLoading,
    isFeedDataLoading,
  } = useCurrentPage()

  const [currentView, setCurrentView] = useState<
    'main' | 'self-hosted' | 'login'
  >('main')

  useEffect(() => {
    // Check for existing session on load
    checkExistingSession()
  }, [checkExistingSession])

  const isUsingProduction =
    settings.readspace_url === PRODUCTION_DEFAULTS.readspace_url

  const openReadspace = () => {
    // Use the app URL, not the API URL
    const appUrl =
      settings.readspace_url === 'https://api.readspace.ai'
        ? 'https://app.readspace.ai'
        : settings.readspace_url.replace('/api', '') // For self-hosted, remove /api if present
    chrome.tabs.create({ url: appUrl })
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginView currentView={currentView} onViewChange={setCurrentView} />
  }

  // Show unsupported page message (only when authenticated)
  if (isUnsupportedPage) {
    return <UnsupportedPage currentUrl={currentTab?.url} />
  }

  // Main authenticated view
  return (
    <MainView
      onOpenReadspace={openReadspace}
      onLogout={logout}
      isSelfHosted={!isUsingProduction}
      isFeedDataLoading={isFeedDataLoading}
      currentPageMetadata={currentPageMetadata}
      isMetadataLoading={isMetadataLoading}
      readingTime={readingTime}
      currentUrl={currentTab?.url}
    />
  )
}

export function Popup() {
  return <PopupContent />
}

// Initialize the popup
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <>
      <Popup />
      <ThemedToaster />
    </>
  )
}
