export function buildStorageFileUrl(
  storageKey: string,
  options?: { download?: boolean; fileName?: string | null }
): string {
  const params = new URLSearchParams({ key: storageKey })
  if (options?.download) {
    params.set('download', '1')
  }
  if (options?.fileName) {
    params.set('name', options.fileName)
  }
  return `/api/storage/file?${params.toString()}`
}

export function extractStorageKeyFromUrl(url: string): string | null {
  if (!url.startsWith('/api/storage/file')) {
    return null
  }
  try {
    const parsed = new URL(url, 'http://localhost')
    return parsed.searchParams.get('key')
  } catch {
    return null
  }
}

