import {error} from '@shopify/cli-kit'

export const WebPageNotAvailable = () => {
  return new error.Abort('Web page not available.')
}
