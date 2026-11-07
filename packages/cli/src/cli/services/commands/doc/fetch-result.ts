import {docFetchJsonOutputSchema, type DocFetchDocument} from './types.js'
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, resolvePath} from '@shopify/cli-kit/node/path'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'

export async function presentDocFetchResult(
  result: DocFetchDocument,
  format: 'json' | 'text',
  outputPath?: string,
): Promise<void> {
  if (outputPath) {
    const absolutePath = resolvePath(outputPath)
    await mkdir(dirname(absolutePath))
    await writeFile(absolutePath, result.document.content)
    outputInfo(`Saved ${result.document.url} to ${absolutePath}`)
    if (format === 'json') {
      outputResult(docFetchJsonOutputSchema.encode({path: absolutePath, format: 'markdown'}))
    }
  } else if (format === 'json') {
    outputResult(docFetchJsonOutputSchema.encode(result))
  } else {
    outputResult(result.document.content)
  }
}
