import browser from "webextension-polyfill";
import './background/supabaseClient'; // Initializes Supabase client
import { handleMessage } from "./background/messageRouter";
import { initTabs } from "./background/tabs";

console.log("Readspace Background Service Worker Starting...");

// Initialize tabs listeners
initTabs();

// Message router
browser.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
    // Return true to indicate we will send a response asynchronously
    (async () => {
        try {
            const response = await handleMessage(msg);
            // In webextension-polyfill, we return the promise instead of using sendResponse
            // But for compatibility with some patterns, we can still use it or return the value
            return { data: response, error: null };
        } catch (e: any) {
            console.error("Message handler error:", e);
            throw new Error(e.message || e.toString());
        }
    })().then(sendResponse).catch((error) => {
        sendResponse({ data: null, error: error.message });
    });

    return true;
});
