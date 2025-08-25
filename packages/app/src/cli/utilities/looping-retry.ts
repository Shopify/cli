export function startLoopingRetry(action: () => Promise<unknown>, concurrency = 1): void {
  const windowMs = 60_000
  const successTimestamps: number[] = []
  const errorTimestamps: number[] = []
  const startedAt = Date.now()
  let totalSuccesses = 0
  let totalErrors = 0
  let attemptsStarted = 0

  const pruneOld = (timestamps: number[], now: number) => {
    while (timestamps.length > 0) {
      const oldest = timestamps[0]
      if (oldest !== undefined && now - oldest > windowMs) {
        timestamps.shift()
      } else {
        break
      }
    }
  }

  const scheduleNext = (fn: () => void) => setTimeout(fn, 0)

  const runWorker = (workerId: number) => {
    const thisAttempt = ++attemptsStarted

    action()
      .then(() => {
        successTimestamps.push(Date.now())
        totalSuccesses += 1
      })
      .catch((error) => {
        errorTimestamps.push(Date.now())
        totalErrors += 1
        // eslint-disable-next-line no-console
        console.error((error as {message?: string}).message)
      })
      .finally(() => {
        const now = Date.now()
        pruneOld(successTimestamps, now)
        pruneOld(errorTimestamps, now)
        const elapsedMs = Math.max(1, now - startedAt)
        const denomMs = Math.min(windowMs, elapsedMs)
        const successPerMin = Math.round((successTimestamps.length * 60_000) / denomMs)
        const errorsPerMin = Math.round((errorTimestamps.length * 60_000) / denomMs)
        const currentMaxAttempt = attemptsStarted
        // eslint-disable-next-line no-console
        console.log(
          `${successPerMin} suc/min, ${errorsPerMin} err/m, ${totalSuccesses} suc, ${totalErrors} err, a${thisAttempt}/${currentMaxAttempt}, w${workerId}`,
        )
        scheduleNext(() => runWorker(workerId))
      })
  }

  const safeConcurrency = Math.max(1, Math.floor(concurrency))
  for (let i = 0; i < safeConcurrency; i += 1) runWorker(i + 1)
}
