import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

type StoreExecuteOutputFormat = 'text' | 'json'

export async function writeOrOutputStoreExecuteResult(
  result: unknown,
  outputFile?: string,
  format: StoreExecuteOutputFormat = 'text',
): Promise<void> {
  const resultString = JSON.stringify(result, null, 2)

  if (outputFile) {
    await writeFile(outputFile, resultString)
    if (format === 'text') {
      renderSuccess({
        headline: 'Operation succeeded.',
        body: `Results written to ${outputFile}`,
      })
    }
  } else {
    if (format === 'text') {
      renderSuccess({headline: 'Operation succeeded.'})
    }
    outputResult(resultString)
  }
}
