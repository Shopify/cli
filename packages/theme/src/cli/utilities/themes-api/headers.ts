import {RestResponse} from '@shopify/cli-kit/src/api/admin.js'

export function retryAfter(response: RestResponse): number {
  const retryAfterStr = header(response, 'retry-after')
  const retryAfter = asInt(retryAfterStr)

  if (!retryAfter) {
    return 0
  }

  return retryAfter
}

export function apiCallLimit(response: RestResponse): [number, number] | undefined {
  const apiCallLimit = header(response, 'x-shopify-shop-api-call-limit')

  const [used, limit] = apiCallLimit
    .split('/')
    .map((num) => asInt(num))
    .filter(Boolean)

  if (!used || !limit) {
    return
  }

  return [used, limit]
}

function header(response: RestResponse, name: string): string {
  const headers = response.headers
  const header = headers[name]

  if (header?.length === 1) {
    return header[0] ?? ''
  }

  return ''
}

function asInt(strValue: string) {
  const intValue = parseInt(strValue, 10)

  if (isNaN(intValue)) {
    return null
  }

  return intValue
}
