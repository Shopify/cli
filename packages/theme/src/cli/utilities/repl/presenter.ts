import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'

export function presentValue(value?: unknown) {
  if (hasJsonError(value)) {
    outputInfo(
      "Object can't be printed, but you can access its fields. Read more at https://shopify.dev/docs/api/liquid.",
    )
    return
  }

  if (value === undefined || value === null) {
    renderValue('null')
    return
  }

  const formattedOutput = JSON.stringify(value, null, 2)
  renderValue(formattedOutput)
}

function hasJsonError(output: unknown): boolean {
  if (Array.isArray(output)) {
    return output.length > 0 ? hasJsonError(output[0]) : false
  }

  if (output && typeof output === 'object') {
    const errorOutput = output as {error?: unknown}
    const errorMessage = errorOutput.error

    return typeof errorMessage === 'string' && errorMessage.includes('json not allowed for this object')
  }

  return false
}

function renderValue(value: string) {
  return outputInfo(outputContent`${outputToken.cyan(value)}`)
}
