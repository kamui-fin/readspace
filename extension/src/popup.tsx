import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import toast, { Toaster } from 'react-hot-toast'
import './index.css'
import { ArticlePreview } from './components/ArticlePreview'
import { AdvancedSaveOptions } from './components/AdvancedSaveOptions'
import { LoginForm } from './components/LoginForm'
import { Settings } from './components/Settings'
import { useExtensionStore } from './store'
import { Button } from './components/ui/button'
import { Settings as SettingsIcon, ExternalLink, AlertTriangle } from 'lucide-react'
import { SaveOptions, PageMetadata } from './types'
import { browser } from '@/lib/browser'

function Popup() {
  const {
    isAuthenticated,
    settings,
    currentPageMetadata,
    isSaving,
    setCurrentPageMetadata,
    saveArticle,
    checkExistingSession,
  } = useExtensionStore()
  
  const [currentView, setCurrentView] = useState<'main' | 'settings' | 'login' | 'advanced-save'>('main')
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [readingTime, setReadingTime] = useState<number | undefined>()
  const [isUnsupportedPage, setIsUnsupportedPage] = useState(false)

  useEffect(() => {
    // Check for existing session on load
    checkExistingSession()
    
    // Get current tab information
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setCurrentTab(tabs[0])
        
        // Check if the URL is supported (http/https)
        const url = tabs[0].url
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          setIsUnsupportedPage(true)
          return
        }
        
        setIsUnsupportedPage(false)
        // Extract metadata from current page
        extractPageMetadata(tabs[0])
      }
    })
  }, [])

  const extractPageMetadata = async (tab: chrome.tabs.Tab) => {
    if (!tab.id) return

    const sendMessage = <T,>(action: string): Promise<T> => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id!, { action }, response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response)
          }
        })
      })
    }

    try {
      let metadata: PageMetadata | undefined
      try {
        metadata = await sendMessage<PageMetadata>('extractMetadata')
      } catch (e: any) {
        if (e.message?.includes('Receiving end does not exist')) {
          console.log('Content script not available. This can happen when:')
          console.log('1. The page was loaded before the extension was enabled')
          console.log('2. The page is a special Chrome page (chrome://, chrome-extension://, etc.)')
          console.log('3. The content script failed to load')
          
          // Instead of trying to inject manually, we'll fall back to basic tab info
          // The content script should automatically load on page refresh or navigation
          throw new Error('Content script not available. Try refreshing the page.')
        } else {
          throw e
        }
      }
      setCurrentPageMetadata(metadata)

      // Also try to get full content for reading time calculation
      try {
        const contentData: { estimated_read_time?: number } = await sendMessage('extractContent')
        if (contentData && contentData.estimated_read_time) {
          setReadingTime(contentData.estimated_read_time)
        }
      } catch (error) {
        console.error('Failed to extract content for reading time:', error)
        // Don't show toast for reading time extraction failure as it's non-critical
      }
    } catch (error) {
      console.error('Failed to extract page metadata:', error)
      // Show user-friendly error message
      toast.error(
        'Failed to extract page information. Try refreshing the page.',
      )

      // Fallback to basic tab information
      setCurrentPageMetadata({
        title: tab.title,
        canonical_url: tab.url,
        favicon: tab.favIconUrl,
      })
    }
  }


  const handleSaveArticle = async (options?: Partial<SaveOptions>) => {
    if (!currentTab?.url) return
    
    try {
      await saveArticle(currentTab.url, options)
      toast.success('Article saved successfully!')
    } catch (error) {
      console.error('Failed to save article:', error)
      toast.error(`Failed to save article: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleAdvancedSave = () => {
    setCurrentView('advanced-save')
  }

  const openReadspace = () => {
    // Use the app URL, not the API URL
    const appUrl = settings.readspace_url === 'https://api.readspace.ai' 
      ? 'https://app.readspace.ai' 
      : settings.readspace_url.replace('/api', '') // For self-hosted, remove /api if present
    chrome.tabs.create({ url: appUrl })
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="w-[450px] min-h-[500px] p-6">
        {currentView === 'settings' ? (
          <Settings onBack={() => setCurrentView('main')} />
        ) : (
          <div className="space-y-6">
            {/* Logo and Title */}
            <div className="text-center mb-2">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12">
                  <img 
                    src={browser.runtime.getURL("src/assets/readspace.svg")} 
                    alt="Readspace" 
                    className="w-full h-full rounded"
                  />
                </div>
              </div>
              <h1 className="text-lg font-semibold">Sign in to Readspace</h1>
            </div>
            
            {/* Embedded Login Form */}
            <LoginForm />
            
            {/* New to Readspace link */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                New to Readspace?{' '}
                <button 
                  onClick={() => window.open('https://app.readspace.ai/signup', '_blank')}
                  className="text-primary hover:underline font-medium"
                >
                  Create account
                </button>
              </p>
            </div>
            
            {/* Instance info / settings link at bottom */}
            <div className="pt-4 border-t">
              {/* Check if using production settings */}
              {settings.readspace_url === 'https://api.readspace.ai' && 
               settings.supabase_url === 'https://hnqyngkyugiamvlhqoaf.supabase.co' ? (
                <button 
                  onClick={() => setCurrentView('settings')}
                  className="text-sm text-muted-foreground hover:text-foreground underline w-full text-center"
                >
                  Have a self-hosted server?
                </button>
              ) : (
                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Using instance: <span className="font-mono">{settings.readspace_url}</span>
                  </p>
                  <button 
                    onClick={() => setCurrentView('settings')}
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                  >
                    Change server settings
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Show unsupported page message (only when authenticated)
  if (isUnsupportedPage) {
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
              Readspace extension only works on websites (http:// and https:// pages). 
              This page type is not supported for saving articles.
            </p>
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                Current page: <span className="font-mono text-xs">{currentTab?.url?.substring(0, 50)}...</span>
              </p>
            </div>
          </div>
        </div>

        {/* Settings overlay */}
        {currentView === 'settings' && (
          <div className="absolute inset-0 bg-background">
            <Settings onBack={() => setCurrentView('main')} />
          </div>
        )}
      </div>
    )
  }

  // Main authenticated view
  return (
    <div className="w-[450px] min-h-[500px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5">
            <img 
              src={browser.runtime.getURL("src/assets/readspace.svg")} 
              alt="Readspace" 
              className="w-full h-full"
            />
          </div>
          <h1 className="font-semibold">Readspace</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={openReadspace}
            className="h-8 w-8 p-0"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('settings')}
            className="h-8 w-8 p-0"
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {currentView === 'settings' ? (
        <Settings onBack={() => setCurrentView('main')} />
      ) : currentView === 'advanced-save' && currentPageMetadata ? (
        <AdvancedSaveOptions
          metadata={currentPageMetadata}
          onSave={handleSaveArticle}
          onCancel={() => setCurrentView('main')}
          isLoading={isSaving}
        />
      ) : (
        <div className="space-y-4">
          {/* Current Page Preview */}
          {currentPageMetadata && (
            <ArticlePreview
              metadata={currentPageMetadata}
              isLoading={isSaving}
              onSave={() => handleSaveArticle()}
              onAdvancedSave={handleAdvancedSave}
              readingTime={readingTime}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Initialize the popup
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <>
      <Popup />
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '14px',
            maxWidth: '350px',
          },
        }}
      />
    </>
  )
} 