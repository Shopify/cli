import {createServer} from 'node:net'

export interface OwnedPort {
  environmentVariable: string
  port: number
}

export function workerPorts(workerIndex: number): OwnedPort[] {
  const portBase = 3457 + workerIndex * 10
  return [
    {environmentVariable: 'SHOPIFY_FLAG_GRAPHIQL_PORT', port: portBase},
    {environmentVariable: 'SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT', port: portBase + 2},
  ]
}

export async function assertPortsAvailable(ports: OwnedPort[], owner: string): Promise<void> {
  const availability = await Promise.all(
    ports.map(async (port) => ({...port, available: await isPortAvailable(port.port)})),
  )
  const occupiedPorts = availability.filter(({available}) => !available)

  if (occupiedPorts.length > 0) {
    const details = occupiedPorts.map(({environmentVariable, port}) => `${environmentVariable}=${port}`).join(', ')
    throw new Error(`[e2e][ports] owner=${owner} unavailable=${details}`)
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen(port, 'localhost', () => server.close(() => resolve(true)))
  })
}
