export function replaceUpdated<T>(arr: T[], updates: T[], cb: (v: T) => unknown): T[] {
  const updatesMap = new Map(updates.map((updated) => [cb(updated), updated]))
  const updated = arr.map((item) => {
    // eslint-disable-next-line node/callback-return
    const key = cb(item)
    if (updatesMap.has(key)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const updated = updatesMap.get(key)!
      updatesMap.delete(key)
      return updated
    } else {
      return item
    }
  })

  return [...updated, ...updatesMap.values()]
}
