import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ArticlePreview } from './components/ArticlePreview'
import { AdvancedSaveOptions } from './components/AdvancedSaveOptions'
import { LoginForm } from './components/LoginForm'
import { Settings } from './components/Settings'
import { useExtensionStore } from './store'
import { Button } from './components/ui/button'
import { Settings as SettingsIcon, ExternalLink } from 'lucide-react'
import { SaveOptions } from './types'

function Popup() {
  const {
    isAuthenticated,
    settings,
    currentPageMetadata,
    isSaving,
    setCurrentPageMetadata,
    saveArticle,
  } = useExtensionStore()
  
  const [currentView, setCurrentView] = useState<'main' | 'settings' | 'login' | 'advanced-save'>('main')
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [readingTime, setReadingTime] = useState<number | undefined>()

  useEffect(() => {
    // Get current tab information
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setCurrentTab(tabs[0])
        // Extract metadata from current page
        extractPageMetadata(tabs[0])
      }
    })
  }, [])

  const extractPageMetadata = async (tab: chrome.tabs.Tab) => {
    if (!tab.id || !tab.url) return

    try {
      // Send message to content script to extract page metadata
      const metadata = await chrome.tabs.sendMessage(tab.id, { action: 'extractMetadata' })
      setCurrentPageMetadata(metadata)
      
      // Also try to get full content for reading time calculation
      try {
        const contentData = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' })
        if (contentData && contentData.estimated_read_time) {
          setReadingTime(contentData.estimated_read_time)
        }
      } catch (error) {
        console.error('Failed to extract content for reading time:', error)
      }
    } catch (error) {
      console.error('Failed to extract page metadata:', error)
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
      // Show success message but don't close popup for debugging
      console.log('Article saved successfully!')
    } catch (error) {
      console.error('Failed to save article:', error)
    }
  }

  const handleAdvancedSave = () => {
    setCurrentView('advanced-save')
  }

  const openReadspace = () => {
    chrome.tabs.create({ url: settings.readspace_url })
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="w-96 min-h-[500px] p-4">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6">
              <img 
                src="/src/assets/readspace.svg" 
                alt="Readspace" 
                className="w-full h-full"
              />
            </div>
            <h1 className="text-xl font-bold">Readspace</h1>
          </div>
          <p className="text-muted-foreground text-sm">Save articles for later reading</p>
        </div>
        
        {currentView === 'login' ? (
          <LoginForm onBack={() => setCurrentView('main')} />
        ) : currentView === 'settings' ? (
          <Settings onBack={() => setCurrentView('main')} />
        ) : (
          <div className="space-y-4">
            {!settings.supabase_url || !settings.supabase_anon_key ? (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Configure Supabase connection to get started
                </p>
                <Button onClick={() => setCurrentView('settings')} className="w-full">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Configure Supabase
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sign in to start saving articles
                </p>
                <Button onClick={() => setCurrentView('login')} className="w-full">
                  Sign In to Readspace
                </Button>
              </div>
            )}
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setCurrentView('settings')}
              className="w-full"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Main authenticated view
  return (
    <div className="w-96 min-h-[500px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5">
            <img 
              src="/src/assets/readspace.svg" 
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
  root.render(<Popup />)
} 