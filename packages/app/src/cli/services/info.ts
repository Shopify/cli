import {output} from '@shopify/cli-kit'

export default function info(app, {format}) {
  if (format === 'json') {
    return output.content`${JSON.stringify(app, null, 2)}`
  } else {
    return output.content`HERE IS SOME TEXT!`
  }
}
