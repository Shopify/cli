/**
 * Perform an action optimistically. If it fails the first time, first initiate
 * a provided recovery procedure, then retry the action. If it fails again,
 * throw the error.
 *
 * This is useful for actions that may fail due to recoverable errors, such as
 * an expired token that can be refreshed. In this case, the recovery procedure
 * would refresh the token.
 *
 * @param performAction - The action to perform.
 * @param recoveryProcedure - The recovery procedure to perform if the action
 * fails the first time.
 * @param retries - The number of times to retry the action if an error happens.
 * @returns The result of the action.
 */
export async function performActionWithRetryAfterRecovery<T>(
  performAction: () => Promise<T>,
  recoveryProcedure: () => Promise<unknown>,
  retries = 1,
): Promise<T> {
  let returnVal: T | undefined
  try {
    returnVal = await performAction()
    return returnVal
  } catch (err) {
    if (retries > 0) {
      // Run the provided recovery procedure, then retry the action
      await recoveryProcedure()
      return performActionWithRetryAfterRecovery(performAction, recoveryProcedure, retries - 1)
    }
    throw err
  }
}
