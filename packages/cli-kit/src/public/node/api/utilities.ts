export const addCursorAndFiltersToAppLogsUrl = (
  baseUrl: string,
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
): string => {
  const url = new URL(baseUrl)

  if (cursor) {
    url.searchParams.append('cursor', cursor)
  }

  if (filters?.status) {
    url.searchParams.append('status', filters.status)
  }

  if (filters?.source) {
    url.searchParams.append('source', filters.source)
  }

  return url.toString()
}
