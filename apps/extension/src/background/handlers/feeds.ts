import { ApiClient, areUrlsEqual } from '@readspace/shared'
import { broadcast } from '../broadcast'
import { isNotFoundError } from '../errors'
import { ItemState, stateStore } from '../state-store'
import { FeedFollowStatus, FollowChangedPayload } from '../../shared/types'

// Mirrors the server's MAX_FOLLOW_CHECK_ITEMS
const MAX_FOLLOW_CHECK_ITEMS = 20

interface CheckFeedFollowedPayload {
  urls: string[]
}

type FollowSnapshot = (ItemState | undefined)[]

function getCachedFollowStatus(
  urls: string[],
  snapshot: FollowSnapshot
): FeedFollowStatus | null {
  const index = snapshot.findIndex((entry) => entry?.saved === true)
  if (index !== -1) {
    return { followed: true, followId: snapshot[index]?.id, url: urls[index] }
  }
  // Explicitly unfollowed entries are still a cache hit
  return snapshot.some(Boolean) ? { followed: false } : null
}

async function fetchFollowStatus(
  urls: string[],
  snapshot: FollowSnapshot
): Promise<FeedFollowStatus> {
  // Known IDs match feeds the server stored under a redirected URL
  const feedIds = snapshot.flatMap((entry) => (entry?.id ? [entry.id] : []))
  const res = await ApiClient.checkFeedFollowed({
    urls: urls.slice(0, MAX_FOLLOW_CHECK_ITEMS),
    feedIds: feedIds.slice(0, MAX_FOLLOW_CHECK_ITEMS),
  })
  if (!res.is_followed || !res.feed_id) return { followed: false }

  const matchedUrl =
    urls.find((_url, i) => snapshot[i]?.id === res.feed_id) ??
    urls.find((url) => res.feed_url && areUrlsEqual(url, res.feed_url)) ??
    urls[0]
  return { followed: true, followId: res.feed_id, url: matchedUrl }
}

function isSnapshotCurrent(urls: string[], snapshot: FollowSnapshot) {
  return urls.every((url, i) => stateStore.getFollowData(url) === snapshot[i])
}

async function storeFollowStatus(urls: string[], status: FeedFollowStatus) {
  // Record every candidate, including negative results. Preserve known IDs on
  // negative entries so redirected feeds can still be checked by ID later.
  await Promise.all(
    urls.map((url) =>
      stateStore.setFollow(
        url,
        status.followed && url === status.url,
        url === status.url ? status.followId : undefined
      )
    )
  )
}

/**
 * Reconcile cached follow state with the server, which may have changed from the web
 * or mobile app. Popups are notified only when the state actually differs.
 */
async function revalidateFollowStatus(
  urls: string[],
  snapshot: FollowSnapshot,
  cached: FeedFollowStatus
) {
  try {
    const fresh = await fetchFollowStatus(urls, snapshot)
    // A follow/unfollow ran while the request was in flight; its state is newer
    if (!isSnapshotCurrent(urls, snapshot)) return
    if (
      fresh.followed === cached.followed &&
      fresh.followId === cached.followId
    ) {
      return
    }

    await storeFollowStatus(urls, fresh)
    const url = fresh.url ?? cached.url
    if (!url) return
    const payload: FollowChangedPayload = {
      url,
      followed: fresh.followed,
      id: fresh.followId,
    }
    broadcast({ type: 'follow-changed', payload })
  } catch (err) {
    console.warn('Failed to revalidate follow state', urls, err)
  }
}

export async function handleCheckFeedFollowed(
  payload: CheckFeedFollowedPayload
): Promise<FeedFollowStatus> {
  const { urls } = payload
  if (urls.length === 0) return { followed: false }

  const snapshot = urls.map((url) => stateStore.getFollowData(url))
  const cached = getCachedFollowStatus(urls, snapshot)
  if (cached) {
    // Serve the cache instantly, then correct it in the background if stale
    void revalidateFollowStatus(urls, snapshot, cached)
    return cached
  }

  const status = await fetchFollowStatus(urls, snapshot)
  // Cache both positive and negative results, and never overwrite a follow action
  // that started while the request was in flight.
  if (isSnapshotCurrent(urls, snapshot)) {
    await storeFollowStatus(urls, status)
  }
  return status
}

interface CreateFeedPayload {
  url: string
  [key: string]: unknown
}

export async function handleCreateFeed(payload: CreateFeedPayload) {
  const { url } = payload
  await stateStore.setFollow(url, true)
  try {
    const res = await ApiClient.createFeed(payload)
    // Store Feed ID (res.feed.id) as API expects feed ID for deletion
    if (res?.feed?.id) {
      await stateStore.setFollow(url, true, res.feed.id)
    }
    return res
  } catch (err) {
    await stateStore.setFollow(url, false)
    throw err
  }
}

interface DeleteFeedPayload {
  feedId: string
  url?: string
}

export async function handleDeleteFeed(payload: DeleteFeedPayload) {
  const { feedId, url } = payload
  if (url) await stateStore.setFollow(url, false)
  try {
    return await ApiClient.deleteFeed(feedId)
  } catch (err: unknown) {
    // If 404, it's already deleted, so don't revert
    if (!isNotFoundError(err)) {
      if (url) await stateStore.setFollow(url, true, feedId) // We know the ID
      throw err
    }
    return null
  }
}

interface FollowPayload {
  url: string
}

export async function handleFollow(payload: FollowPayload) {
  // Reuse handleCreateFeed
  await handleCreateFeed({ url: payload.url })
  return { success: true }
}

interface UnfollowPayload {
  url: string
}

export async function handleUnfollow(payload: UnfollowPayload) {
  const { url } = payload
  const id = stateStore.getFollowId(url)

  if (!id) {
    console.warn('Attempted to unfollow without ID', url)
    // Optimistically unfollow anyway?
    await stateStore.setFollow(url, false)
    return { success: true }
  }

  await handleDeleteFeed({ feedId: id, url })
  return { success: true }
}
