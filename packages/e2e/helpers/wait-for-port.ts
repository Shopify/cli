import * as net from 'net'

/**
 * Polls until a TCP connection to host:port succeeds, or timeout is reached.
 */
export async function waitForPort(port: number, host = '127.0.0.1', timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  const interval = 500

  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const connected = await tryConnect(port, host)
    if (connected) return
    // eslint-disable-next-line no-await-in-loop
    await sleep(interval)
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${host}:${port}`)
}

function tryConnect(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, host)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
