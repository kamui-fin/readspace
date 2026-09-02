import browser from 'webextension-polyfill'
import { supabase } from './supabase-client'
import { ExtensionMessage } from '../shared/types'
import { ApiClient } from '@readspace/shared'
import { pageCache } from '../lib/page-cache'
import { stateStore } from './state-store'
import * as AuthHandlers from './handlers/auth'
import * as ArticleHandlers from './handlers/articles'
import * as FeedHandlers from './handlers/feeds'

export async function handleMessage(msg: ExtensionMessage) {
  // Ensure state store is initialized
  await stateStore.init()

  switch (msg.type) {
    case 'login':
      return supabase.auth.signInWithPassword(msg.payload)

    case 'logout':
      await stateStore.clear()
      return supabase.auth.signOut({ scope: 'local' })

    case 'getSession':
      return (await browser.storage.local.get('session')).session

    case 'fetchFolders':
      return ApiClient.listFolders()

    // Article Actions
    case 'saveArticle':
      return ArticleHandlers.handleSaveArticle(msg.payload)

    case 'unsaveArticle':
      return ArticleHandlers.handleUnsaveArticle(msg.payload)

    case 'updateArticle':
      return ArticleHandlers.handleUpdateArticle(msg.payload)

    case 'checkArticleSaved':
      return ArticleHandlers.handleCheckArticleSaved(msg.payload)

    case 'checkFeedFollowed':
      return FeedHandlers.handleCheckFeedFollowed(msg.payload)

    case 'getProfile':
      return ApiClient.getProfile()

    // Feed Actions
    case 'createFeed':
      return FeedHandlers.handleCreateFeed(msg.payload)

    case 'deleteFeed':
      return FeedHandlers.handleDeleteFeed(msg.payload)

    case 'startGoogleOAuth':
      return AuthHandlers.startGoogleOAuth()

    case 'getCachedPageByUrl':
      return pageCache.get(msg.payload)

    case 'config-changed':
      // Config change is handled by supabase-client listener
      return { success: true }

    default:
      throw new Error(`Unknown message type: ${msg.type}`)
  }
}
