export interface Feed {
    id: string;
    name: string;
    iconUrl?: string;
    unreadCount: number;
    folderId?: string | null;
}

export interface Folder {
    id: string;
    name: string;
    feedIds: string[];
}

export const MOCK_FOLDERS: Folder[] = [
    {
        id: 'folder-1',
        name: 'Various Blogs',
        feedIds: ['feed-1', 'feed-2'],
    },
    {
        id: 'folder-2',
        name: 'System Design',
        feedIds: ['feed-5', 'feed-6'],
    },
    {
        id: 'folder-3',
        name: 'Technology News',
        feedIds: ['feed-3', 'feed-4'],
    },
    {
        id: 'folder-4',
        name: 'Empty Folder',
        feedIds: [],
    },
];

export const MOCK_FEEDS: Feed[] = [
    {
        id: 'feed-1',
        name: 'Nintendo Life',
        iconUrl: 'https://via.placeholder.com/32/000000/FFFFFF?text=N',
        unreadCount: 8,
        folderId: 'folder-1',
    },
    {
        id: 'feed-2',
        name: 'TechCrunch',
        iconUrl: 'https://via.placeholder.com/32/0A9D58/FFFFFF?text=TC',
        unreadCount: 10,
        folderId: 'folder-1',
    },
    {
        id: 'feed-3',
        name: 'Hacker News',
        iconUrl: 'https://via.placeholder.com/32/FF6600/FFFFFF?text=Y',
        unreadCount: 45,
        folderId: 'folder-3',
    },
    {
        id: 'feed-4',
        name: 'The Verge',
        iconUrl: 'https://via.placeholder.com/32/FA4616/FFFFFF?text=V',
        unreadCount: 23,
        folderId: 'folder-3',
    },
    {
        id: 'feed-5',
        name: 'System Design Newsletter',
        iconUrl: 'https://via.placeholder.com/32/4285F4/FFFFFF?text=SD',
        unreadCount: 5,
        folderId: 'folder-2',
    },
    {
        id: 'feed-6',
        name: 'High Scalability',
        iconUrl: 'https://via.placeholder.com/32/34A853/FFFFFF?text=HS',
        unreadCount: 12,
        folderId: 'folder-2',
    },
];

export function getFeedsByFolder(folderId: string): Feed[] {
    return MOCK_FEEDS.filter((feed) => feed.folderId === folderId);
}

export function getFeedsWithoutFolder(): Feed[] {
    return MOCK_FEEDS.filter((feed) => feed.folderId === null);
}

export function getFolderUnreadCount(folderId: string): number {
    return getFeedsByFolder(folderId).reduce((sum, feed) => sum + feed.unreadCount, 0);
}

