import {consoleWarn} from './output.js'
import {isUnitTest} from '../../public/node/context/local.js'
import {collectLog, outputWhereAppropriate} from '../../public/node/output.js'
import {commandEventSchema, type CommandEvent} from '../../public/common/command-events.js'

/**
 * Writes a command event as JSON without routing it back through the command event context.
 *
 * @param event - The event to write.
 */
export function outputCommandEventAsJson(event: CommandEvent): void {
  const message = JSON.stringify(commandEventSchema.parse(event))
  if (isUnitTest()) collectLog('info', message)
  outputWhereAppropriate('info', consoleWarn, message)
}
