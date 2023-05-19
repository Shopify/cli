import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'

export async function findUIEntryPath(directory: string) {
  const entryPath = (
    await Promise.all(
      ['index']
        .flatMap((name) => [`${name}.js`, `${name}.jsx`, `${name}.ts`, `${name}.tsx`])
        .flatMap((fileName) => [`src/${fileName}`, `${fileName}`])
        .map((relativePath) => joinPath(directory, relativePath))
        .map(async (sourcePath) => ((await fileExists(sourcePath)) ? sourcePath : undefined)),
    )
  ).find((sourcePath) => sourcePath !== undefined)
  if (!entryPath) {
    throw new AbortError(
      outputContent`Couldn't find an index.{js,jsx,ts,tsx} file in the directories ${outputToken.path(
        directory,
      )} or ${outputToken.path(joinPath(directory, 'src'))}`,
    )
  }

  return entryPath
}
