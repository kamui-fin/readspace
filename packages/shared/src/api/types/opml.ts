import { ImportStatus } from "./common";

// OPML Import types

export interface FeedImportError {
  url: string;
  title: string;
  error: string;
  status: string;
}

// Alias
export type OpmlImportError = FeedImportError;

export interface OpmlImportResponse {
  task_id: string;
  message: string;
  estimated_feeds: number;
}

export interface OpmlImportProgress {
  completed: number;
  total: number;
  successful: number;
  failed: number;
  already_existed: number;
  skipped_limit: number;
}

export interface OpmlImportResult extends OpmlImportProgress {
  total_feeds: number;
  message: string;
  errors?: FeedImportError[] | null;
}

export interface OpmlTaskMetadata {
  user_id: string;
  task_id: string;
  estimated_feeds: number;
  filename: string;
  opml_title?: string | null;
  opml_author?: string | null;
  created_at: string;
  status: ImportStatus;
}

export interface OpmlImportStatusResponse {
  task_id: string;
  status: ImportStatus;
  message: string;
  progress?: OpmlImportProgress | null;
  result?: OpmlImportResult | null;
  error?: string | null;
  metadata?: OpmlTaskMetadata | null;
}

// Legacy alias
export type OpmlImportTask = OpmlImportStatusResponse;

export interface OpmlImportCancelResponse {
  task_id: string;
  message: string;
  cancelled: boolean;
  previous_state?: ImportStatus | null;
}
