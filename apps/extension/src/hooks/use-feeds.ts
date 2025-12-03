import { useState, useEffect } from 'react'
import { sendMessage } from '../shared/messaging'

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

    const mutateAsync = async (data: { feedId: string; url?: string }) => {
        setIsPending(true)
        try {
            return await sendMessage({ type: 'deleteFeed', payload: data })
        } finally {
            setIsPending(false)
        }
    }

    return { mutateAsync, isPending }
}

export function useFolders() {
    const [data, setData] = useState<any[] | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    // Simple fetch on mount
    // In a real app we'd use react-query or SWR
    const refetch = async () => {
        setIsLoading(true)
        try {
            const res = await sendMessage({ type: 'fetchFolders' })
            setData(res)
        } catch (err) {
            setError(err as Error)
        } finally {
            setIsLoading(false)
        }
    }

    // Initial fetch
    useEffect(() => {
        refetch()
    }, [])

    return { data, isLoading, error, refetch }
}
