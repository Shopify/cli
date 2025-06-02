import {AbortError} from '@shopify/cli-kit/node/error'

export function validateVersion(version: string | undefined) {
  if (typeof version === 'undefined') return

  const errorMessage = ['Invalid version name: ', {userInput: version}]

  const versionMaxLength = 100
  if (version.length > versionMaxLength) {
    throw new AbortError(errorMessage, `Version name must be ${versionMaxLength} characters or less.`)
  }

  const invalidCompleteWords = ['.', '..']
  if (invalidCompleteWords.find((invalidCompleteWord) => version === invalidCompleteWord)) {
    throw new AbortError(
      errorMessage,
      `Version name may not be any of: ${invalidCompleteWords.map((word) => `'${word}'`).join(' , ')}`,
    )
  }

  const validChars = /^[a-zA-Z0-9.\-_]+$/
  if (!version.match(validChars)) {
    throw new AbortError(errorMessage, [
      'Version name can only contain alphanumeric characters, periods, hyphens, and underscores',
    ])
  }
}
