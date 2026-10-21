import {readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function loadConsoleInputs(inputs?: string[], inputFile?: string): Promise<string[] | undefined> {
  if (inputFile === undefined) return inputs

  const contents = await readFile(inputFile)
  const commands = contents.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (commands.length === 0) throw new AbortError('The input file must contain at least one Liquid command.')
  return commands
}
