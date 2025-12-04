import browser from 'webextension-polyfill'
import debounce from 'debounce'
import { normalizeKey } from '../lib/normalize'

const FOLLOW_KEY = 'readspace-follow-v1'
const SAVE_KEY = 'readspace-save-v1'
const PERSIST_DEBOUNCE_MS = 1000

export type ItemState = {
    ts: number
    id?: string
    priority?: string
    note?: string
    title?: string
    saved?: boolean
}

class StateStore {
    private follow = new Map<string, ItemState>()
    private save = new Map<string, ItemState>()
    private initialized = false

    private persistFollowDebounced = debounce(() => this.persistFollow(), PERSIST_DEBOUNCE_MS)
    private persistSaveDebounced = debounce(() => this.persistSave(), PERSIST_DEBOUNCE_MS)

    async init() {
        if (this.initialized) return
        const kv = await browser.storage.local.get([FOLLOW_KEY, SAVE_KEY])
        const f = kv[FOLLOW_KEY] || {}
        const s = kv[SAVE_KEY] || {}

        Object.entries(f).forEach(([k, v]) => {
            const item = v as ItemState
            if (item.saved === undefined) item.saved = true
            this.follow.set(k, item)
        })

        Object.entries(s).forEach(([k, v]) => {
            const item = v as ItemState
            if (item.saved === undefined) item.saved = true
            this.save.set(k, item)
        })

        this.initialized = true
    }

    isFollowed(rawUrl: string) {
        return this.follow.get(normalizeKey(rawUrl))?.saved === true
    }

    getFollowId(rawUrl: string) {
        return this.follow.get(normalizeKey(rawUrl))?.id
    }

    isSaved(rawUrl: string) {
        return this.save.get(normalizeKey(rawUrl))?.saved === true
    }

    getSaveId(rawUrl: string) {
        return this.save.get(normalizeKey(rawUrl))?.id
    }

    getSaveData(rawUrl: string) {
        return this.save.get(normalizeKey(rawUrl))
    }

    async setFollow(rawUrl: string, value: boolean, id?: string) {
        const url = normalizeKey(rawUrl)
        const existing = this.follow.get(url)

        this.follow.set(url, {
            ts: Date.now(),
            saved: value,
            id: id || existing?.id
        })
        this.persistFollowDebounced()
    }

    async setSave(
        rawUrl: string,
        value: boolean,
        id?: string,
        data?: { priority?: string; note?: string; title?: string }
    ) {
        const url = normalizeKey(rawUrl)
        const existing = this.save.get(url)

        this.save.set(url, {
            ts: Date.now(),
            saved: value,
            id: id || existing?.id,
            priority: data?.priority ?? existing?.priority,
            note: data?.note ?? existing?.note,
            title: data?.title ?? existing?.title,
        })
        this.persistSaveDebounced()
    }

    private async persistFollow() {
        const obj = Object.fromEntries(this.follow)
        await browser.storage.local.set({ [FOLLOW_KEY]: obj })
    }

    private async persistSave() {
        const obj = Object.fromEntries(this.save)
        await browser.storage.local.set({ [SAVE_KEY]: obj })
    }

    async clear() {
        this.follow.clear()
        this.save.clear()
        await browser.storage.local.remove([FOLLOW_KEY, SAVE_KEY])
    }
}

export const stateStore = new StateStore()
