import {randomUUID} from 'crypto'

export const generate = (): string => {
  return randomUUID()
}
