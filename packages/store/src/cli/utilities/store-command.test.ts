import StoreCommand from './store-command.js'
import {addPublicMetadata, addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {Flags} from '@oclif/core'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('@shopify/cli-kit/node/crypto')

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
    vi.mocked(hashString).mockReturnValue('hashed-store')
  })

  test('records shared store command metadata when parsing --store', async () => {
    await TestStoreCommand.run(['--store', 'shop.myshopify.com'])

    expect(addSensitiveMetadata).toHaveBeenCalledWith(expect.any(Function))
    expect(vi.mocked(addSensitiveMetadata).mock.calls[0]![0]()).toEqual({store_fqdn: 'shop.myshopify.com'})
    expect(addPublicMetadata).toHaveBeenCalledWith(expect.any(Function))
    const publicMetadataCalls = vi.mocked(addPublicMetadata).mock.calls.map((call) => call[0]())
    expect(publicMetadataCalls).toContainEqual({store_fqdn_hash: 'hashed-store'})
  })
})
