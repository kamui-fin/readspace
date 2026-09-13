/** True when an API call failed because the resource no longer exists on the server. */
export function isNotFoundError(err: unknown): boolean {
  const error = err as { status?: number; message?: string } | null
  return (
    error?.status === 404 ||
    !!error?.message?.toLowerCase().includes('not found')
  )
}
