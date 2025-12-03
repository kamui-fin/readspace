import browser from 'webextension-polyfill';
import { ExtensionMessage } from './types';

export async function sendMessage<T = any>(msg: ExtensionMessage): Promise<T> {
    try {
        const response = (await browser.runtime.sendMessage(msg)) as { data: T; error?: string };
        if (!response) {
            throw new Error("No response");
        }
        if (response.error) {
            throw new Error(response.error);
        }
        return response.data;
    } catch (error) {
        throw error;
    }
}

export function sendTabMessage<T>(tabId: number, type: string, timeout = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout: ${type} took longer than ${timeout}ms`))
        }, timeout)

        browser.tabs.sendMessage(tabId, { type })
            .then((response) => {
                clearTimeout(timer)
                resolve(response as T)
            })
            .catch((error) => {
                clearTimeout(timer)
                reject(error)
            })
    })
}
