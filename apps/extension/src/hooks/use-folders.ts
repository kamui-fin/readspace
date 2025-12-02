import { useState } from 'react'
import { sendMessage } from '../shared/messaging'

export function useCreateFolder() {
    const [isPending, setIsPending] = useState(false)

    const mutateAsync = async (data: { name: string }) => {
        setIsPending(true)
        try {
            return await sendMessage({ type: 'createFolder', payload: data })
        } finally {
            setIsPending(false)
        }
    }

    return { mutateAsync, isPending }
}

export function useUpdateFolder() {
    const [isPending, setIsPending] = useState(false)

    const mutateAsync = async (data: { folderId: string; name: string }) => {
        setIsPending(true)
        try {
            return await sendMessage({
                type: 'updateFolder',
                payload: { folderId: data.folderId, data: { name: data.name } }
            })
        } finally {
            setIsPending(false)
        }
    }

    return { mutateAsync, isPending }
}

export function useDeleteFolder() {
    const [isPending, setIsPending] = useState(false)

    const mutateAsync = async (folderId: string) => {
        setIsPending(true)
        try {
            return await sendMessage({ type: 'deleteFolder', payload: { folderId } })
        } finally {
            setIsPending(false)
        }
    }

    return { mutateAsync, isPending }
}
