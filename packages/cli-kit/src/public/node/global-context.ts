export interface GlobalContext {
  currentCommandId: string
  inputDisabled: boolean
}

let _globalContext: GlobalContext | undefined

/**
 * Get the global context.
 *
 * @returns Global context.
 */
function getGlobalContext(): GlobalContext {
  _globalContext ??= {currentCommandId: '', inputDisabled: false}
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

/**
 * Returns whether the current command explicitly disabled user input.
 *
 * @returns True when `--no-input` is active.
 */
export function isInputDisabled(): boolean {
  return getGlobalContext().inputDisabled
}

/**
 * Controls whether the current command may request user input.
 *
 * @param disabled - Whether user input is disabled.
 */
export function setInputDisabled(disabled: boolean): void {
  getGlobalContext().inputDisabled = disabled
}
