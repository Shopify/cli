import {Environment} from '../../context/service.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

const mockServiceEnvironment = vi.fn()
const mockIsRunning2024 = vi.fn()

vi.mock('../../context/service.js', async () => {
  const actual = await vi.importActual('../../context/service.js')
  return {
    ...actual,
    serviceEnvironment: (...args: unknown[]) => mockServiceEnvironment(...args),
  }
})

vi.mock('../../../../public/node/vendor/dev_server/dev-server-2024.js', async () => {
  const actual = await vi.importActual('../../../../public/node/vendor/dev_server/dev-server-2024.js')
  return {
    ...actual,
    isRunning2024: (...args: unknown[]) => mockIsRunning2024(...args),
  }
})

describe('getIdentityClient', () => {
  beforeEach(async () => {
    mockServiceEnvironment.mockReset()
    mockIsRunning2024.mockReset()
    vi.resetModules()
  })

  test('returns IdentityServiceClient when environment is Production', async () => {
    mockServiceEnvironment.mockReturnValue(Environment.Production)
    mockIsRunning2024.mockReturnValue(false)

    const {getIdentityClient} = await import('./instance.js')

    const instance = getIdentityClient()

    expect(instance.constructor.name).toBe('IdentityServiceClient')
  })

  test('returns IdentityServiceClient when environment is Local and identity service is running', async () => {
    mockServiceEnvironment.mockReturnValue(Environment.Local)
    mockIsRunning2024.mockReturnValue(true)

    const {getIdentityClient} = await import('./instance.js')

    const instance = getIdentityClient()

    expect(instance.constructor.name).toBe('IdentityServiceClient')
    expect(mockIsRunning2024).toHaveBeenCalledWith('identity')
  })

  test('returns IdentityMockClient when environment is Local and identity service is not running', async () => {
    mockServiceEnvironment.mockReturnValue(Environment.Local)
    mockIsRunning2024.mockReturnValue(false)

    const {getIdentityClient} = await import('./instance.js')

    const instance = getIdentityClient()

    expect(instance.constructor.name).toBe('IdentityMockClient')
    expect(mockIsRunning2024).toHaveBeenCalledWith('identity')
  })

  test('returns the same instance on subsequent calls (singleton pattern)', async () => {
    mockServiceEnvironment.mockReturnValue(Environment.Production)
    mockIsRunning2024.mockReturnValue(false)

    const {getIdentityClient} = await import('./instance.js')

    const firstInstance = getIdentityClient()
    const secondInstance = getIdentityClient()

    expect(firstInstance).toBe(secondInstance)
    expect(mockServiceEnvironment).toHaveBeenCalledTimes(1)
  })
})
