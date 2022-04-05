/**
 * This function is designed to be a utility that pauses
 * the execution of an e2e tests for debugging purposes.
 * @returns A promise that resolves after a long period.
 */
const sleep = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 60 * 60 * 1000)
  })
}

export default sleep
