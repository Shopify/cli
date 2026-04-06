import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export async function writeOrOutputStoreExecuteResult(result: unknown, outputFile?: string): Promise<void> {
  const resultString = JSON.stringify(result, null, 2)

  if (outputFile) {
    await writeFile(outputFile, resultString)
    renderSuccess({
      headline: 'Operation succeeded.',
      body: `Results written to ${outputFile}`,
    })
  } else {
    renderSuccess({headline: 'Operation succeeded.'})
    outputResult(resultString)
  }
}
