interface DeprecationsStore {
  nextDeprecation: Deprecation | undefined
}

interface GlobalWithDeprecationsStore {
  deprecationsStore: DeprecationsStore
}

interface SupportedUntilDateDeprecation {
  date: Date
}

interface DeprecatingSoonDeprecation {
  deprecatingSoon: boolean
}

export type Deprecation = SupportedUntilDateDeprecation | DeprecatingSoonDeprecation

const globalWithDeprecationsStore: GlobalWithDeprecationsStore = {
  ...globalThis,
  deprecationsStore: {
    nextDeprecation: undefined,
  },
}

/**
 * Get the earliest date in the future when deprecations will no longer be supported, if any.
 *
 * @returns The next deprecation date.
 */
export function getDeprecation(): Deprecation | undefined {
  return globalWithDeprecationsStore.deprecationsStore.nextDeprecation
}

/**
 * Set the next deprecation date to the earliest date in the future.
 *
 * @param dates - Dates when deprecations will no longer be supported.
 */
export function setDeprecationDates(dates: Date[]) {
  if (dates.length < 1) return

  const earliestFutureDateTime = earliestDateTimeAfter(Date.now(), dates)
  if (!earliestFutureDateTime) return

  const nextDeprecation = getDeprecation()

  if (typeof nextDeprecation !== 'undefined' && 'deprecatingSoon' in nextDeprecation) {
    return
  }

  if (!nextDeprecation || earliestFutureDateTime < nextDeprecation.date.getTime()) {
    globalWithDeprecationsStore.deprecationsStore.nextDeprecation = {
      date: new Date(earliestFutureDateTime),
    }
  }
}

export function setDeprecatingSoon() {
  globalWithDeprecationsStore.deprecationsStore.nextDeprecation = {
    deprecatingSoon: true,
  }
}

export function resetDeprecation() {
  globalWithDeprecationsStore.deprecationsStore.nextDeprecation = undefined
}

function earliestDateTimeAfter(afterTime: number, dates: Date[]): number | undefined {
  const times = dates.map((date) => date.getTime())
  return times.sort().find((time) => time > afterTime)
}
