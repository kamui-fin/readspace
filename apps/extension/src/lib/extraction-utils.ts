import { sendMessage } from '../shared/messaging'
import browser from 'webextension-polyfill'

export async function extractContentForSave(url: string) {
    // Try cache first
    try {
        const cachedPage = await sendMessage<any>({
            type: 'getCachedPageByUrl',
            payload: url,
        })
        if (cachedPage) {
            return {
                ...cachedPage.metadata,
                content: cachedPage.content?.content,
                ...cachedPage.content
            }
        }
    } catch { }

    // Try page extraction
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true })
        if (tabs[0]?.id) {
            return await browser.tabs.sendMessage(tabs[0].id, {
                type: 'extractContent',
                url: url,
            })
        }
    } catch (error) {
        console.error('Failed to extract content:', error)
    }

    return null
}
