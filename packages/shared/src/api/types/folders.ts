export interface FolderResponse {
  id: string;
  name: string;
  created_at: string;
}

export type Folder = FolderResponse;

export interface FolderCreate {
  name: string;
}

export interface FolderUpdate {
  name?: string;
}
