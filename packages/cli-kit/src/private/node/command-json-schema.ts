import {AbortError} from '../../public/node/error.js'
import {commandEventOutputSchema} from '../../public/node/command-events.js'
import {jsonErrorOutputSchema} from '../../public/node/error/schema.js'
import {defineJsonOutputSchema, type JsonOutputSchema} from '../../public/node/json-output-schema.js'
import {flushStdout, outputResult} from '../../public/node/output.js'
import {zod} from '../../public/node/schema.js'
import {normalizeArgv} from '@oclif/core/help'
import type {LazyCommandLoader} from '../../public/node/custom-oclif-loader.js'
import type {Config} from '@oclif/core'

/**
 * Loads a command's schema without running its lifecycle or Oclif hooks.
 *
 * @param config - The loaded CLI configuration.
 * @param argv - The CLI arguments, including the command name.
 * @param lazyCommandLoader - The optional loader for bundled commands.
 */
export async function printCommandJsonSchema(
  config: Config,
  argv: string[],
  lazyCommandLoader?: LazyCommandLoader,
): Promise<void> {
  const [id] = normalizeArgv(config, argv)
  if (!id || id.startsWith('-')) throw new AbortError('Specify a command to inspect its JSON output schema.')

  const command = config.findCommand(id)
  if (!command) throw new AbortError(`Command "${id}" not found.`)

  const commandClass = (await lazyCommandLoader?.(command.id)) ?? (await command.load())
  const outputSchema = (commandClass as typeof commandClass & {jsonOutputSchema?: JsonOutputSchema}).jsonOutputSchema
  if (!outputSchema) throw new AbortError('This command does not define a JSON output schema.')

  const commandSchema = defineJsonOutputSchema({
    name: 'CommandOutput',
    schema: zod.union([outputSchema.schema, jsonErrorOutputSchema.schema, commandEventOutputSchema.schema]),
    definitions: {
      Result: outputSchema.schema,
      Error: jsonErrorOutputSchema.schema,
      Event: commandEventOutputSchema.schema,
    },
  })
  outputResult(JSON.stringify(commandSchema.jsonSchema, null, 2))
  await flushStdout()
}
