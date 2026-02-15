import { useState } from 'react'
import toast from 'react-hot-toast'
import { sendMessage } from '../shared/messaging'
import {
  PageMetadata,
  Priority,
  CheckArticleSavedResponse,
} from '@readspace/shared'
import { useCheckArticleSaved } from './use-check-article-saved'
import { useArticleForm } from './use-article-form'
import { extractContentForSave } from '../lib/extraction-utils'

interface UseArticleActionsProps {
  currentUrl?: string
  metadata?: PageMetadata
}

export function useArticleActions({
  currentUrl,
  metadata,
}: UseArticleActionsProps) {
  const { savedArticle, setSavedArticle } = useCheckArticleSaved(currentUrl)
  const { form, setForm, hasUnsavedChanges } = useArticleForm(savedArticle)

  const [status, setStatus] = useState({
    isPreparing: false,
    isSaving: false,
    isUnsaving: false,
    isUpdating: false,
  })

  const isSaved =
    (!!savedArticle && savedArticle.is_saved) ||
    status.isSaving ||
    status.isPreparing
  const isPending = Object.values(status).some(Boolean)

  const handleSave = async (options?: {
    title?: string
    note?: string
    priority?: Priority
  }) => {
    if (!currentUrl) return

    const titleToUse = options?.title ?? form.title
    const noteToUse = options?.note ?? form.note
    const priorityToUse = options?.priority ?? form.priority

    if (isSaved && savedArticle && savedArticle.is_saved) {
      // Update or Unsave
      const effectiveHasChanges = hasUnsavedChanges || !!options

      if (effectiveHasChanges) {
        await updateArticle(savedArticle.article_id, currentUrl, {
          title: titleToUse,
          user_note: noteToUse,
          priority: priorityToUse,
        })
      } else {
        await unsaveArticle(savedArticle.article_id, currentUrl)
      }
    } else {
      // Save New
      await saveNewArticle(
        currentUrl,
        {
          title: titleToUse,
          note: noteToUse,
          priority: priorityToUse,
        },
        metadata
      )
    }
  }

  const updateArticle = async (
    articleId: string,
    url: string,
    data: Record<string, unknown>
  ) => {
    setStatus((prev) => ({ ...prev, isUpdating: true }))
    try {
      await sendMessage({
        type: 'updateArticle',
        payload: { articleId, url, data },
      })
      toast.success('Article updated')
      const updated = await sendMessage<CheckArticleSavedResponse>({
        type: 'checkArticleSaved',
        payload: { url },
      })
      setSavedArticle(updated)
    } catch (error) {
      toast.error('Failed to update article')
      console.error(error)
    } finally {
      setStatus((prev) => ({ ...prev, isUpdating: false }))
    }
  }

  const unsaveArticle = async (articleId: string, url: string) => {
    setStatus((prev) => ({ ...prev, isUnsaving: true }))
    try {
      await sendMessage({
        type: 'unsaveArticle',
        payload: { articleId, url },
      })
      toast.success('Article removed')
      setSavedArticle(null)
    } catch (error) {
      toast.error('Failed to remove article')
      console.error(error)
    } finally {
      setStatus((prev) => ({ ...prev, isUnsaving: false }))
    }
  }

  const saveNewArticle = async (
    url: string,
    data: { title?: string; priority?: Priority; note?: string },
    initialMetadata?: PageMetadata
  ) => {
    setStatus((prev) => ({ ...prev, isPreparing: true, isSaving: true }))
    toast.success('Article saved')

    try {
      const extractedContent = await extractContentForSave(url)

      // Build metadata
      const metadataObj: Record<string, string> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const source = (extractedContent || initialMetadata || {}) as any

      if (source.description) metadataObj.description = source.description
      if (source.author) metadataObj.author = source.author
      if (source.published_at) metadataObj.published_at = source.published_at
      if (source.image_url) metadataObj.image_url = source.image_url
      if (initialMetadata?.favicon)
        metadataObj.favicon = initialMetadata.favicon

      await sendMessage({
        type: 'saveArticle',
        payload: {
          url,
          title:
            data.title ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (extractedContent as any)?.title ||
            initialMetadata?.title,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: (extractedContent as any)?.content,
          metadata:
            Object.keys(metadataObj).length > 0 ? metadataObj : undefined,
          priority: data.priority,
          note: data.note,
        },
      })

      const updated = await sendMessage<CheckArticleSavedResponse>({
        type: 'checkArticleSaved',
        payload: { url },
      })
      setSavedArticle(updated)
    } catch (error) {
      console.error('Failed to save article:', error)
      toast.error('Failed to save article')
    } finally {
      setStatus((prev) => ({ ...prev, isPreparing: false, isSaving: false }))
    }
  }

  return {
    savedArticle,
    formState: {
      customTitle: form.title,
      setCustomTitle: (t: string) => setForm((prev) => ({ ...prev, title: t })),
      note: form.note,
      setNote: (n: string) => setForm((prev) => ({ ...prev, note: n })),
      priority: form.priority,
      setPriority: (p: Priority) =>
        setForm((prev) => ({ ...prev, priority: p })),
    },
    status: {
      isSaved,
      hasUnsavedChanges,
      isPreparingToSave: status.isPreparing,
      isPending,
      isSavePending: status.isSaving,
      isUnsavePending: status.isUnsaving,
      isUpdatePending: status.isUpdating,
    },
    actions: {
      handleSave,
    },
  }
}
