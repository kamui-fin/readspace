import { ApiClient } from "../core";
import {
  ImportStatus,
  OpmlImportCancelResponse,
  OpmlImportResponse,
  OpmlTaskMetadata,
  OpmlImportStatusResponse,
} from "../types/opml";

export const opml = {
  importOPML: (formData: FormData) =>
    ApiClient.uploadFile(
      "/api/opml/import/",
      formData,
    ) as Promise<OpmlImportResponse>,
  getImportTaskStatus: (taskId: string) =>
    ApiClient.get<OpmlImportStatusResponse>(
      `/api/opml/import/status/${taskId}`,
    ),
  getActiveImportTask: () =>
    ApiClient.get<OpmlTaskMetadata | null>("/api/opml/import/active"),
  cancelImportTask: (taskId: string) =>
    ApiClient.delete<OpmlImportCancelResponse>(
      `/api/opml/import/cancel/${taskId}`,
    ),
};
