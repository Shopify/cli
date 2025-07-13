export interface GlobalContext {
  currentCommandId: string
  currentSlice?: {
    name: string
    id: string
  }
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

/**
 * Get the current slice information.
 *
 * @returns Current slice info or undefined.
 */
export function getCurrentSlice(): {name: string; id: string} | undefined {
  return getGlobalContext().currentSlice
}

/**
 * Set the current slice information.
 *
 * @param slice - Slice information with name and id.
 * @param slice.name
 * @param slice.id
 */
export function setCurrentSlice(slice: {name: string; id: string}): void {
  getGlobalContext().currentSlice = slice
}
