import {error} from '@shopify/cli-kit'

export const WebPageNotAvailable = () => {
  return new error.Abort('Web page not available.')
}

export const TooManyRequestsError = () => {
  return new Error("You've made too many requests. Please try again later.")
}

export const UnrecoverableError = (message: string) => {
  return new Error(`Unrecoverable: ${message}`)
}
