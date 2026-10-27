import {outputInfo} from '@shopify/cli-kit/node/output'

export const fetchChecksums = async () => []
export const uploadTheme = () => ({workPromise: Promise.resolve(), renderThemeSyncProgress: async () => {}})

let requests = 0

export async function render() {
  requests++
  if (requests === 6) {
    for (let index = 0; index < 1000; index++) outputInfo(`line ${index}`)
  }
  return new Response('<script>Shopify.theme={"name":"Fixture","id":456}</script>', {
    headers: {'content-type': 'text/html', 'x-request-id': 'fixture'},
  })
}
