import {appendToTokenItem, tokenItemToString, type TokenItem} from './components/token-item.js'

export function messageWithPunctuation(message: TokenItem) {
  const messageToString = tokenItemToString(message)
  return messageToString.endsWith('?') || messageToString.endsWith(':') || messageToString.endsWith('.')
    ? message
    : appendToTokenItem(message, ':')
}
