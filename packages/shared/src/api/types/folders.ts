export type Folder = {
    id: string;
    name: string;
    created_at: string;
};

export type FolderCreate = {
    name: string;
};

export type FolderUpdate = {
    name?: string;
};
