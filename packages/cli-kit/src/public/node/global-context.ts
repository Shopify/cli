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
export function getCurrentSlice(): SliceInfo | undefined {
  return getGlobalContext().currentSlice
}

/**
 * Slice information interface.
 */
interface SliceInfo {
  name: string
  id: string
}

/**
 * Sets the current slice information in the global context.
 *
 * @param slice - The slice information containing name and id.
 */
export function setCurrentSlice(slice: SliceInfo): void {
  getGlobalContext().currentSlice = slice
}
