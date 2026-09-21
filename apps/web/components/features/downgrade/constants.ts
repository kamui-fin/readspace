/**
 * Instrument Serif, the display serif shared with the landing site, for this flow's headlines
 * and ledger figures. Applied as an explicit fontFamily (not a utility) for the same reason as
 * the Daily Digest's READING_SERIF: the `font-serif` theme variable resolves empty at :root.
 */
export const DISPLAY_SERIF =
    "var(--font-display-serif), var(--font-garamond-serif), ui-serif, Georgia, serif"
