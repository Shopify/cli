export async function tryWithRetryAfterRecoveryFunction<T>(action: () => Promise<T>, recovery: () => Promise<unknown>): Promise<T> {
  let returnVal: T | undefined
  try {
    returnVal = await action()
    return returnVal
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    // Retry once with a new token, in case the token expired or was revoked
    await recovery()
    return action()
  }
}
