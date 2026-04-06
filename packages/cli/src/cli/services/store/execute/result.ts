import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

type StoreExecuteOutputFormat = 'text' | 'json'

function serializeStoreExecuteResult(result: unknown): string {
  return JSON.stringify(result, null, 2)
}

function renderStoreExecuteSuccess(outputFile?: string): void {
  if (outputFile) {
    renderSuccess({
      headline: 'Operation succeeded.',
      body: `Results written to ${outputFile}`,
    })
    return
  }

  renderSuccess({headline: 'Operation succeeded.'})
}

export async function writeOrOutputStoreExecuteResult(
  result: unknown,
  outputFile?: string,
  format: StoreExecuteOutputFormat = 'text',
): Promise<void> {
  const serializedResult = serializeStoreExecuteResult(result)

  if (outputFile) {
    await writeFile(outputFile, serializedResult)
    if (format === 'text') renderStoreExecuteSuccess(outputFile)
    return
  }

  if (format === 'text') renderStoreExecuteSuccess()
  outputResult(serializedResult)
}
