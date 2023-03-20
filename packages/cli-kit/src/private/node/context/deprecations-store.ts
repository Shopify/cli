interface DeprecationsStore {
  nextDeprecationDate: Date | undefined
}

interface GlobalWithDeprecationsStore {
  deprecationsStore: DeprecationsStore
}

const globalWithDeprecationsStore: GlobalWithDeprecationsStore = {
  ...globalThis,
  deprecationsStore: {
    nextDeprecationDate: undefined,
  },
}

/**
 * Get the earliest date in the future when deprecations will no longer be supported, if any.
 *
 * @returns The next deprecation date.
 */
export function getNextDeprecationDate(): Date | undefined {
  return globalWithDeprecationsStore.deprecationsStore.nextDeprecationDate
}

/**
 * Set the next deprecation date to the earliest date in the future.
 *
 * @param dates - Dates when deprecations will no longer be supported.
 */
export function setNextDeprecationDate(dates: Date[]): Date | undefined {
  if (dates.length < 1) return

  const earliestFutureDateTime = earliestDateTimeAfter(Date.now(), dates)
  if (!earliestFutureDateTime) return

  const nextDeprecationDate = getNextDeprecationDate()
  if (!nextDeprecationDate || earliestFutureDateTime < nextDeprecationDate.getTime()) {
    globalWithDeprecationsStore.deprecationsStore.nextDeprecationDate = new Date(earliestFutureDateTime)
  }
}

function earliestDateTimeAfter(afterTime: number, dates: Date[]): number | undefined {
  const times = dates.map((date) => date.getTime())
  return times.sort().find((time) => time > afterTime)
}
