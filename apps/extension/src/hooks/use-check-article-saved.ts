import { useState, useEffect } from 'react'
import { sendMessage } from '../shared/messaging'
import { CheckArticleSavedResponse } from '@readspace/shared'

export function useCheckArticleSaved(url?: string) {
    const [savedArticle, setSavedArticle] = useState<CheckArticleSavedResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!url) {
            setSavedArticle(null)
            return
        }

        let mounted = true
        setIsLoading(true)

        sendMessage<CheckArticleSavedResponse>({ type: 'checkArticleSaved', payload: url })
            .then((data) => {
                if (mounted) setSavedArticle(data)
            })
            .catch((err) => {
                console.error('Failed to check if article is saved:', err)
            })
            .finally(() => {
                if (mounted) setIsLoading(false)
            })

        return () => { mounted = false }
    }, [url])

    return { savedArticle, setSavedArticle, isLoading }
}
