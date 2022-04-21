import * as port from 'get-port-please'

export function getRandomPort(): Promise<number> {
  return port.getRandomPort()
}
