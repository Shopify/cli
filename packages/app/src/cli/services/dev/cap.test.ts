import {devStoreCapReached} from './cap.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {ClientName, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {describe, expect, test, vi} from 'vitest'

describe('devStoreCapReached', () => {
  test('returns the cap value for an app-management client', async () => {
    const client = testDeveloperPlatformClient({
      clientName: ClientName.AppManagement,
      devStoreCapReached: vi.fn().mockResolvedValue(true),
    })

    await expect(devStoreCapReached('1', client)).resolves.toBe(true)
    expect(client.devStoreCapReached).toHaveBeenCalledWith('1')
  })

  test('keeps the client receiver when the cap query uses this', async () => {
    const client = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    client.devStoreCapReached = async function (this: DeveloperPlatformClient) {
      return this.clientName === ClientName.AppManagement
    }

    await expect(devStoreCapReached('1', client)).resolves.toBe(true)
  })

  test('fails open when the cap request fails', async () => {
    const client = testDeveloperPlatformClient({
      clientName: ClientName.AppManagement,
      devStoreCapReached: vi.fn().mockRejectedValue(new Error('field is unavailable')),
    })

    await expect(devStoreCapReached('1', client)).resolves.toBe(false)
  })

  test('fails open when the app-management client does not expose the cap query', async () => {
    const client = testDeveloperPlatformClient({clientName: ClientName.AppManagement})

    expect(client.devStoreCapReached).toBeUndefined()
    await expect(devStoreCapReached('1', client)).resolves.toBe(false)
  })

  test('does not query Partners clients', async () => {
    const client = testDeveloperPlatformClient({
      clientName: ClientName.Partners,
      devStoreCapReached: vi.fn().mockResolvedValue(true),
    })

    await expect(devStoreCapReached('1', client)).resolves.toBe(false)
    expect(client.devStoreCapReached).not.toHaveBeenCalled()
  })
})
