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
 */
export async function performActionWithRetryAfterRecovery<T>(
  performAction: () => Promise<T>,
  recoveryProcedure: () => Promise<unknown>,
): Promise<T> {
  let returnVal: T | undefined
  try {
    returnVal = await performAction()
    return returnVal
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    // Run the provided recovery procedure, then retry the action
    await recoveryProcedure()
    return performAction()
  }
}
