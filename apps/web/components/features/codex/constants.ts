/**
 * EB Garamond, matched to the article reader — applied as an explicit `fontFamily` with the
 * CJK serif fallbacks, not the `font-serif` utility (which some ancestor styling can shadow).
 * Shared by the parts of the Daily Digest surface a person is meant to *read*: the synthesised
 * through-line and the Development titles (Serif-Reads Rule).
 */
export const READING_SERIF =
    "var(--font-garamond-serif), var(--font-noto-serif-sc), var(--font-noto-serif-jp), var(--font-noto-serif-tc), ui-serif, Georgia, serif"
