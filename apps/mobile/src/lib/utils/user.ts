interface UserLike {
  id?: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
};

/**
 * Title-case an email local part: `ada.lovelace` -> `Ada Lovelace`,
 * `ada_l99` -> `Ada L99`. Separators become spaces; anything already
 * capitalised is left alone so `adaLovelace` doesn't become `Adalovelace`.
 */
const humanizeHandle = (handle: string): string =>
  handle
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((part) =>
      part === part.toLowerCase() ? part.charAt(0).toUpperCase() + part.slice(1) : part
    )
    .join(' ');

/**
 * The name to show for a user.
 *
 * Only OAuth providers populate `full_name`, so email/password accounts used to
 * fall back to the literal string "User" — which is both unhelpful and, because
 * the avatar is seeded from this name, gave every one of those accounts the
 * *same* generated avatar. The email's local part is a far better stand-in.
 */
export function getUserDisplayName(user: UserLike | null | undefined): string {
  const metadata = user?.user_metadata ?? {};
  const named = pickString(
    metadata.full_name,
    metadata.name,
    metadata.preferred_username,
    metadata.user_name
  );
  if (named) return named;

  const localPart = user?.email?.split('@')[0];
  if (localPart) return humanizeHandle(localPart);

  return 'Your account';
}

/**
 * Stable, unique seed for the generated avatar. The user id never changes and
 * is unique per account, so it gives each user a distinct avatar that survives
 * them later setting a display name.
 */
export function getUserAvatarSeed(user: UserLike | null | undefined): string {
  return pickString(user?.id, user?.email) ?? 'readspace';
}
