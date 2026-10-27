import {readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function loadConsoleInputs(inputs?: string[], scriptFile?: string): Promise<string[] | undefined> {
  if (scriptFile === undefined) return inputs

  const contents = await readFile(scriptFile)
  const commands = contents.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (commands.length === 0) throw new AbortError('The script file must contain at least one Liquid command.')
  return commands
}
