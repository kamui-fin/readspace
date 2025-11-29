// OPML Import types

export type ImportStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown";

export type OpmlImportResponse = {
  task_id: string;
  message: string;
  estimated_feeds: number;
};

export type OpmlImportProgress = {
  completed: number;
  total: number;
  successful: number;
  failed: number;
  already_existed: number;
  skipped_limit: number;
};

export type OpmlImportError = {
  title?: string;
  url?: string;
  error?: string;
  [key: string]: any;
};

export type OpmlImportResult = OpmlImportProgress & {
  total_feeds: number;
  message: string;
  errors?: Array<OpmlImportError>;
};

export type OpmlImportTask = OpmlImportStatusResponse;

export type OpmlTaskMetadata = {
  user_id: string;
  task_id: string;
  estimated_feeds: number;
  filename: string;
  opml_title?: string;
  opml_author?: string;
  created_at: string;
  status: ImportStatus;
};

export type OpmlImportStatusResponse = {
  task_id: string;
  status: ImportStatus;
  message: string;
  progress?: OpmlImportProgress;
  result?: OpmlImportResult;
  error?: string;
  metadata?: OpmlTaskMetadata;
};

export type OpmlImportCancelResponse = {
  task_id: string;
  message: string;
  cancelled: boolean;
  previous_state?: ImportStatus;
};
