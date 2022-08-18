import {system, error} from '@shopify/cli-kit'

export const WebPageNotAvailable = () => {
  return new error.Abort('Web page not available.')
}

export const retryOnError = async <T>(
  execute: () => T,
  maxIteration = 5,
  waitTime: number | ((n: number) => number) = 1,
) => {
  for (const iteration of [...Array(maxIteration)]) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await execute()
    } catch (executionError: unknown) {
      // eslint-disable-next-line no-await-in-loop
      await system.sleep(typeof waitTime === 'number' ? waitTime : waitTime(iteration))

      if (iteration + 1 === maxIteration) throw new error.Abort((executionError as error.Abort).message)
    }
  }
}
