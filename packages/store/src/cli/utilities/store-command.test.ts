import StoreCommand from './store-command.js'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {Flags} from '@oclif/core'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/metadata')

class TestStoreCommand extends StoreCommand {
  static flags = {
    store: Flags.string({required: true}),
  }

  async run(): Promise<void> {
    await this.parse(TestStoreCommand)
  }
}

describe('StoreCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('does not record store-specific metadata during base parsing', async () => {
    await TestStoreCommand.run(['--store', 'shop.myshopify.com'])

    const sensitiveMetadataCalls = vi.mocked(addSensitiveMetadata).mock.calls.map((call) => call[0]())
    const publicMetadataCalls = vi.mocked(addPublicMetadata).mock.calls.map((call) => call[0]())

    expect(sensitiveMetadataCalls).not.toContainEqual(expect.objectContaining({store_fqdn: 'shop.myshopify.com'}))
    expect(publicMetadataCalls).not.toContainEqual(expect.objectContaining({store_fqdn_hash: expect.any(String)}))
  })
})
