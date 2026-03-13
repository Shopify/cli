import {appendToTokenItem, TokenItem, tokenItemToString} from './components/token-utils.js'

export function messageWithPunctuation(message: TokenItem) {
  const messageToString = tokenItemToString(message)
  return messageToString.endsWith('?') || messageToString.endsWith(':') || messageToString.endsWith('.')
    ? message
    : appendToTokenItem(message, ':')
}
