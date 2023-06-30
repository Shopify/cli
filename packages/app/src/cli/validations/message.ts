import {AbortError} from '@shopify/cli-kit/node/error'

export function validateMessage(message: string | undefined) {
  if (typeof message === 'undefined') return

  const errorMessage = ['Invalid message:', {userInput: message}]

  const messageMaxLength = 200
  if (message.length > messageMaxLength) {
    throw new AbortError(errorMessage, `Message name must be ${messageMaxLength} characters or less.`)
  }
}
