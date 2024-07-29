export type StartTime = [number, number]

/**
 * Returns the current high-resolution real time in a [seconds, nanoseconds] tuple Array.
 *
 * @returns The current high-resolution real time.
 */
export function startHRTime(): StartTime {
  return process.hrtime()
}

/**
 * Given a start time tuple, it returns the end time string with the time in miliseconds.
 *
 * @param startTime - Time tuple.
 * @returns Time in miliseconds.
 */
export function endHRTimeInMs(startTime: StartTime): string {
  const endTime = process.hrtime(startTime)
  return (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2)
}
