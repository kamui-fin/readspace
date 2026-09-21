/**
 * Indices of the Following header tabs, in the order they are rendered.
 *
 * `Today` leads and is the default landing view: the inbox people actually open
 * the app for. `All` is the full backlog, `Saved` is Read Later.
 *
 * These indices are persisted (`readspace-following`) and are the source of
 * truth for tab identity across the header, the query selection, the empty
 * states and the client-side filters — always reference the constant, never a
 * bare number, so a future reorder stays a one-line change plus a store
 * migration.
 */
export const FOLLOWING_TAB = {
  TODAY: 0,
  ALL: 1,
  SAVED: 2,
  /**
   * Reading history. Reachable from Settings ("Reading History"), never
   * rendered in the header tab row, so it has no button config.
   */
  RECENT: 3,
} as const;

export type FollowingTab = (typeof FOLLOWING_TAB)[keyof typeof FOLLOWING_TAB];

/** No tab is active — a feed or folder is being viewed instead. */
export const NO_ACTIVE_TAB = -1;
