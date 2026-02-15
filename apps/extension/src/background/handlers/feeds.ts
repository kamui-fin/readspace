import { ApiClient } from '@readspace/shared'
import { stateStore } from '../state-store'

interface CheckFeedFollowedPayload {
  url: string
}

export function handleCheckFeedFollowed(payload: CheckFeedFollowedPayload) {
  return {
    followed: stateStore.isFollowed(payload.url),
    followId: stateStore.getFollowId(payload.url),
  }
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
    const error = err as { status?: number; message?: string }
    if (
      error?.status !== 404 &&
      !error?.message?.toLowerCase().includes('not found')
    ) {
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
