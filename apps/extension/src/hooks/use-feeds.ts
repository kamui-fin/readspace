import { useState, useEffect, useCallback } from 'react'
import { sendMessage } from '../shared/messaging'
import { FeedsResponse } from '@readspace/shared'

export function useFeeds() {
    const [data, setData] = useState<FeedsResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const refetch = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await sendMessage({ type: 'fetchFeeds' })
            setData(res)
            setError(null)
        } catch (e) {
            setError(e as Error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        refetch()
    }, [refetch])

    return { data, isLoading, error, refetch }
}

export function useCreateFeed() {
    const [isPending, setIsPending] = useState(false)

    const mutateAsync = async (data: { url: string; folder_id?: string }) => {
        setIsPending(true)
        try {
            return await sendMessage({ type: 'createFeed', payload: data })
        } finally {
            setIsPending(false)
        }
    }

    return { mutateAsync, isPending }
}

export function useDeleteFeed() {
    const [isPending, setIsPending] = useState(false)

    const mutateAsync = async (data: { feedId: string }) => {
        setIsPending(true)
        try {
            return await sendMessage({ type: 'deleteFeed', payload: data })
        } finally {
            setIsPending(false)
        }
    }

    return { mutateAsync, isPending }
}
