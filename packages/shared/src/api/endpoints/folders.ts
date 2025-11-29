import { ApiClient } from "../core";
import { Folder } from "../types/folders";

export const folders = {
  getFolders: () => ApiClient.get<Folder[]>("/api/folders/"),
  getFolder: (id: string) => ApiClient.get<Folder>(`/api/folders/${id}`),
  createFolder: (data: { name: string }) =>
    ApiClient.post<Folder>("/api/folders/", data),
  updateFolder: (id: string, data: { name: string }) =>
    ApiClient.put<Folder>(`/api/folders/${id}`, data),
  deleteFolder: (id: string) => ApiClient.delete<void>(`/api/folders/${id}`),
  markFolderAllRead: (folder_id: string) =>
    ApiClient.put<{
      message: string;
      folder_id: string;
      updated_subscriptions: number;
    }>(`/api/folders/${folder_id}/read-status`),
};
