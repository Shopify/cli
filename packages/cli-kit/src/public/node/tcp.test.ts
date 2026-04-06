import {getAvailableTCPPort, checkPortAvailability} from './tcp.js'
import {describe, expect, test} from 'vitest'
import {createServer} from 'net'

describe('getAvailableTCPPort', () => {
  test('returns a valid port number', async () => {
    const port = await getAvailableTCPPort()
    expect(port).toBeGreaterThan(0)
    expect(port).toBeLessThanOrEqual(65535)
  })

  test('returns the preferred port when it is available', async () => {
    const freePort = await getAvailableTCPPort()
    const got = await getAvailableTCPPort(freePort)
    expect(got).toBe(freePort)
  })

  test('returns a different port when the preferred one is in use', async () => {
    const server = createServer()
    const occupiedPort = await new Promise<number>((resolve) => {
      server.listen(0, 'localhost', () => {
        const address = server.address()
        resolve((address as {port: number}).port)
      })
    })

    try {
      const got = await getAvailableTCPPort(occupiedPort)
      expect(got).not.toBe(occupiedPort)
      expect(got).toBeGreaterThan(0)
    } finally {
      server.close()
    }
  })

  test('returns unique ports across multiple calls', async () => {
    const ports = new Set<number>()
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      const port = await getAvailableTCPPort()
      ports.add(port)
    }
    expect(ports.size).toBe(5)
  })

  test('returns unique ports and all are bindable', async () => {
    const ports: number[] = []
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-await-in-loop
      ports.push(await getAvailableTCPPort())
    }
    expect(new Set(ports).size).toBe(3)

    // Verify all ports are actually bindable
    const servers = await Promise.all(
      ports.map(
        (port) =>
          new Promise<ReturnType<typeof createServer>>((resolve, reject) => {
            const server = createServer()
            server.once('error', reject)
            server.listen(port, 'localhost', () => resolve(server))
          }),
      ),
    )
    // All three bound successfully — clean up
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
  })
})

describe('checkPortAvailability', () => {
  test('returns true when port is available', async () => {
    const freePort = await getAvailableTCPPort()
    const result = await checkPortAvailability(freePort)
    expect(result).toBe(true)
  })

  test('returns false when port is in use', async () => {
    const server = createServer()
    const occupiedPort = await new Promise<number>((resolve) => {
      server.listen(0, 'localhost', () => {
        const address = server.address()
        resolve((address as {port: number}).port)
      })
    })

    try {
      const result = await checkPortAvailability(occupiedPort)
      expect(result).toBe(false)
    } finally {
      server.close()
    }
  })
})
