import {consoleWarn, outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'

export function presentValue(value?: unknown) {
  if (hasJsonError(value)) {
    consoleWarn(
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
  switch (typeof output) {
    case 'object':
      if (Array.isArray(output)) {
        return hasJsonError(output[0])
      } else if (output !== null) {
        const errorOutput = output as {error?: string}
        return errorOutput.error?.includes('json not allowed for this object') ?? false
      }
      return false
    default:
      return false
  }
}

function renderValue(value: string) {
  return outputInfo(outputContent`${outputToken.cyan(value)}`)
}
