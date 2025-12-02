import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import browser from 'webextension-polyfill'
import { sendMessage } from '../shared/messaging'
import { PageMetadata, Priority, CheckArticleSavedResponse } from '@readspace/shared'
import { useCheckArticleSaved } from './use-check-article-saved'

interface UseArticleActionsProps {
    currentUrl?: string
    metadata?: PageMetadata
}

export function useArticleActions({ currentUrl, metadata }: UseArticleActionsProps) {
    const { savedArticle, setSavedArticle } = useCheckArticleSaved(currentUrl)

    // Form State
    const [form, setForm] = useState({
        title: '',
        note: '',
        priority: 'LOW' as Priority,
    })

    // Original State (for detecting changes)
    const [originalForm, setOriginalForm] = useState({
        title: '',
        note: '',
        priority: 'LOW' as Priority,
    })

    const [status, setStatus] = useState({
        isPreparing: false,
        isSaving: false,
        isUnsaving: false,
        isUpdating: false,
    })

    // Sync form fields with saved article
    useEffect(() => {
        if (savedArticle && savedArticle.is_saved) {
            const newState = {
                title: savedArticle.title || '',
                note: savedArticle.note || '',
                priority: (savedArticle.priority || 'LOW') as Priority,
            }
            setForm(newState)
            setOriginalForm(newState)
        } else {
            const defaultState = { title: '', note: '', priority: 'LOW' as Priority }
            setForm(defaultState)
            setOriginalForm(defaultState)
        }
    }, [savedArticle])

    // Derived State
    const isSaved = (!!savedArticle && savedArticle.is_saved) || status.isSaving || status.isPreparing
    const hasUnsavedChanges =
        !!savedArticle &&
        (form.title !== originalForm.title ||
            form.note !== originalForm.note ||
            form.priority !== originalForm.priority)

    const isPending = Object.values(status).some(Boolean)

    const handleSave = async () => {
        if (!currentUrl) return

        if (isSaved && savedArticle && savedArticle.is_saved) {
            // Update existing article
            if (hasUnsavedChanges) {
                setStatus(prev => ({ ...prev, isUpdating: true }))
                try {
                    await sendMessage({
                        type: 'updateArticle',
                        payload: {
                            articleId: savedArticle.article_id,
                            data: {
                                priority: form.priority,
                                note: form.note || undefined,
                            },
                        }
                    })
                    toast.success('Article updated')
                    const updated = await sendMessage<CheckArticleSavedResponse>({ type: 'checkArticleSaved', payload: currentUrl })
                    setSavedArticle(updated)
                } catch (error) {
                    toast.error('Failed to update article')
                    console.error(error)
                } finally {
                    setStatus(prev => ({ ...prev, isUpdating: false }))
                }
                return
            }

            // Unsave article
            setStatus(prev => ({ ...prev, isUnsaving: true }))
            try {
                await sendMessage({
                    type: 'unsaveArticle',
                    payload: {
                        articleId: savedArticle.article_id,
                        url: currentUrl,
                    }
                })
                toast.success('Article removed')
                setSavedArticle(null)
            } catch (error) {
                toast.error('Failed to remove article')
                console.error(error)
            } finally {
                setStatus(prev => ({ ...prev, isUnsaving: false }))
            }
        } else {
            // Save new article
            setStatus(prev => ({ ...prev, isPreparing: true, isSaving: true }))
            toast.success('Article saved') // Optimistic toast

            try {
                // Extract content
                let extractedContent: any = null

                // Try cache first
                try {
                    const cachedPage = await sendMessage<PageMetadata & { content?: string }>({
                        type: 'getCachedPageByUrl',
                        payload: currentUrl,
                    })
                    if (cachedPage?.content) {
                        extractedContent = { ...cachedPage, content: cachedPage.content }
                    }
                } catch { }

                // Try page extraction
                if (!extractedContent) {
                    try {
                        const tabs = await browser.tabs.query({ active: true, currentWindow: true })
                        if (tabs[0]?.id) {
                            extractedContent = await browser.tabs.sendMessage(tabs[0].id, {
                                type: 'extractContent',
                                url: currentUrl,
                            })
                        }
                    } catch (error) {
                        console.error('Failed to extract content:', error)
                    }
                }

                // Build metadata
                const metadataObj: Record<string, string> = {}
                const source = extractedContent || metadata || {}

                if (source.description) metadataObj.description = source.description
                if (source.author) metadataObj.author = source.author
                if (source.published_at) metadataObj.published_at = source.published_at
                if (source.image_url) metadataObj.image_url = source.image_url
                if (metadata?.favicon) metadataObj.favicon = metadata.favicon

                // Save
                await sendMessage({
                    type: 'saveArticle',
                    payload: {
                        url: currentUrl,
                        title: form.title || extractedContent?.title || metadata?.title,
                        content: extractedContent?.content,
                        metadata: Object.keys(metadataObj).length > 0 ? metadataObj : undefined,
                        priority: form.priority,
                        note: form.note || undefined,
                    }
                })

                const updated = await sendMessage<CheckArticleSavedResponse>({ type: 'checkArticleSaved', payload: currentUrl })
                setSavedArticle(updated)

            } catch (error) {
                console.error('Failed to save article:', error)
                toast.error('Failed to save article')
            } finally {
                setStatus(prev => ({ ...prev, isPreparing: false, isSaving: false }))
            }
        }
    }

    return {
        savedArticle,
        formState: {
            customTitle: form.title,
            setCustomTitle: (t: string) => setForm(prev => ({ ...prev, title: t })),
            note: form.note,
            setNote: (n: string) => setForm(prev => ({ ...prev, note: n })),
            priority: form.priority,
            setPriority: (p: Priority) => setForm(prev => ({ ...prev, priority: p })),
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
