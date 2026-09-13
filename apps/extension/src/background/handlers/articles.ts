import {
  ApiClient,
  CheckArticleSavedResponse,
  Priority,
} from '@readspace/shared'
import { normalizeKey } from '../../lib/normalize'
import { broadcast } from '../broadcast'
import { isNotFoundError } from '../errors'
import { ItemState, stateStore } from '../state-store'
import { SaveChangedPayload } from '../../shared/types'

interface SaveArticlePayload {
  url: string
  priority?: Priority
  note?: string
  title?: string
  content?: string
  metadata?: Record<string, string>
}

export async function handleSaveArticle(payload: SaveArticlePayload) {
  const { url } = payload
  // Optimistic update
  await stateStore.setSave(url, true)
  try {
    const res = await ApiClient.saveArticle(payload)
    // Update state with ID from response
    if (res?.article_id) {
      await stateStore.setSave(url, true, res.article_id, {
        priority: payload.priority?.toString(),
        note: payload.note,
        title: payload.title,
      })
    }
    return res
  } catch (err) {
    // Revert
    await stateStore.setSave(url, false)
    throw err
  }
}

interface UnsaveArticlePayload {
  url?: string
  articleId?: string
}

export async function handleUnsaveArticle(payload: UnsaveArticlePayload) {
  const { url, articleId } = payload
  // Get ID from state if not provided
  const idToUse = articleId || (url ? stateStore.getSaveId(url) : undefined)

  if (url) await stateStore.setSave(url, false)

  try {
    if (idToUse) {
      const res = await ApiClient.updateArticle(
        idToUse,
        { is_saved: false },
        'clipped'
      )
      return res
    } else {
      console.warn('Attempted to unsave article without ID', url)
      return { success: true }
    }
  } catch (err) {
    // Already removed on the server (e.g. from another client): the unsaved state is correct
    if (isNotFoundError(err)) return { success: true }
    if (url) await stateStore.setSave(url, true, idToUse) // Revert
    throw err
  }
}

interface UpdateArticlePayload {
  articleId: string
  data: {
    priority?: number
    user_note?: string
    title?: string
    [key: string]: unknown
  }
  url?: string
}

export async function handleUpdateArticle(payload: UpdateArticlePayload) {
  const { articleId, data } = payload

  if (payload.url) {
    await stateStore.setSave(payload.url, true, articleId, {
      priority: data.priority?.toString(),
      note: data.user_note, // Map user_note to note
      title: data.title,
    })
  }

  return ApiClient.updateArticle(
    articleId,
    {
      ...data,
      priority: data.priority?.toString(),
    },
    'clipped'
  )
}

interface CheckArticleSavedPayload {
  url: string
}

function cachedToResponse(state: ItemState): CheckArticleSavedResponse {
  if (!state.saved) {
    return { is_saved: false, article_id: null }
  }

  // A saved entry can lack an ID while its save request is still in flight
  return {
    is_saved: true,
    article_id: state.id,
    priority: state.priority,
    note: state.note,
    title: state.title,
  } as CheckArticleSavedResponse
}

function responseToState(
  res: CheckArticleSavedResponse
): Omit<ItemState, 'ts'> {
  if (!res.is_saved) return { saved: false }
  return {
    saved: true,
    id: res.article_id,
    priority: res.priority ? String(res.priority) : undefined,
    note: res.note || undefined,
    title: res.title || undefined,
  }
}

function isSameSaveState(a: Omit<ItemState, 'ts'>, b: Omit<ItemState, 'ts'>) {
  if ((a.saved === true) !== (b.saved === true)) return false
  if (!a.saved) return true
  return (
    a.id === b.id &&
    a.priority === b.priority &&
    a.note === b.note &&
    a.title === b.title
  )
}

/**
 * Reconcile a cached entry with the server, which may have changed from the web or
 * mobile app. Popups are notified only when the state actually differs.
 */
async function revalidateSaveState(url: string, cached: ItemState) {
  try {
    const res = await ApiClient.checkArticleSaved(url)
    // A save/unsave/update ran while the request was in flight; its state is newer
    if (stateStore.getSaveData(url) !== cached) return

    const fresh = responseToState(res)
    if (isSameSaveState(cached, fresh)) return

    await stateStore.replaceSave(url, fresh)
    const payload: SaveChangedPayload = { url: normalizeKey(url), article: res }
    broadcast({ type: 'save-changed', payload })
  } catch (err) {
    console.warn('Failed to revalidate saved state', url, err)
  }
}

export async function handleCheckArticleSaved(
  payload: CheckArticleSavedPayload
) {
  const cached = stateStore.getSaveData(payload.url)
  if (cached) {
    // Serve the cache instantly, then correct it in the background if stale
    void revalidateSaveState(payload.url, cached)
    return cachedToResponse(cached)
  }

  const res = await ApiClient.checkArticleSaved(payload.url)
  // Cache both positive and negative results, but never overwrite an action that
  // started while the request was in flight.
  if (!stateStore.getSaveData(payload.url)) {
    await stateStore.replaceSave(payload.url, responseToState(res))
  }
  return res
}
