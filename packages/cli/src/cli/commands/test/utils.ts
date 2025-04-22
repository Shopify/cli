import {type Page} from 'playwright'

export const waitForNetworkIdle = async (page: Page, idleTime = 500, timeout = 10000): Promise<void> => {
  const pending = new Set<Request>()
  let lastActivity = Date.now()

  const onRequest = (req: unknown) => {
    pending.add(req as Request)
    lastActivity = Date.now()
  }

  const onDone = (req: unknown) => {
    pending.delete(req as Request)
    lastActivity = Date.now()
  }

  page.on('request', onRequest)
  page.on('requestfinished', onDone)
  page.on('requestfailed', onDone)

  return new Promise((resolve, reject) => {
    const start = Date.now()

    const check = () => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivity

      if (pending.size === 0 && timeSinceLastActivity >= idleTime) {
        cleanup()
        resolve()
      } else if (now - start > timeout) {
        cleanup()
        reject(new Error(`waitForNetworkIdle timed out after ${timeout}ms`))
      }
    }

    const interval = setInterval(check, 100)

    const cleanup = () => {
      clearInterval(interval)
      page.off('request', onRequest)
      page.off('requestfinished', onDone)
      page.off('requestfailed', onDone)
    }
  })
}
