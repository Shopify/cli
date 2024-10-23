export interface GlobalContext {
  currentCommandId: string
}

let _globalContext: GlobalContext | undefined

/**
 * Get the global context.
 *
 * @returns Global context.
 */
function getGlobalContext(): GlobalContext {
  if (!_globalContext) {
    _globalContext = {currentCommandId: ''}
  }
  return _globalContext
}

/**
 * Get the current command ID.
 *
 * @returns Current command ID.
 */
export function getCurrentCommandId(): string {
  return getGlobalContext().currentCommandId
}

/**
 * Set the current command ID.
 *
 * @param commandId - Command ID.
 */
export function setCurrentCommandId(commandId: string): void {
  getGlobalContext().currentCommandId = commandId
}
