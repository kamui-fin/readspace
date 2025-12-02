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
