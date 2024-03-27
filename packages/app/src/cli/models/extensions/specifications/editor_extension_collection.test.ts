import {ExtensionInstance} from '../extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {testDeveloperPlatformClient} from '../../app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()

describe('editor_extension_collection', async () => {
  interface EditorExtensionCollectionProps {
    directory: string
    configuration: {name: string; handle: string; includes?: string[]; include?: {handle: string}[]}
  }

  async function getTestEditorExtensionCollection({
    directory,
    configuration: passedConfig,
  }: EditorExtensionCollectionProps) {
    const configurationPath = joinPath(directory, 'shopify.extension.toml')
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'editor_extension_collection')!
    const configuration = {
      ...passedConfig,
      type: 'editor_extension_collection',
      metafields: [],
    }

    return new ExtensionInstance({
      configuration,
      directory,
      specification,
      configurationPath,
      entryPath: '',
    })
  }

  describe('deployConfig()', () => {
    test('returns the deploy config when includes and include is passed in', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const configuration = {
          name: 'Order summary',
          handle: 'order-summary-collection',
          includes: ['handle1'],
          include: [
            {
              handle: 'handle2',
            },
          ],
        }
        const extensionCollection = await getTestEditorExtensionCollection({
          directory: tmpDir,
          configuration,
        })

        const deployConfig = await extensionCollection.deployConfig({
          apiKey: 'apiKey',
          developerPlatformClient,
        })

        expect(deployConfig).toStrictEqual({
          name: extensionCollection.configuration.name,
          handle: extensionCollection.configuration.handle,
          in_collection: [{handle: 'handle1'}, {handle: 'handle2'}],
        })
      })
    })

    test('returns the deploy config when only include is passed in', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const configuration = {
          name: 'Order summary',
          handle: 'order-summary-collection',
          include: [
            {
              handle: 'handle2',
            },
          ],
        }
        const extensionCollection = await getTestEditorExtensionCollection({
          directory: tmpDir,
          configuration,
        })

        const deployConfig = await extensionCollection.deployConfig({
          apiKey: 'apiKey',
          developerPlatformClient,
        })

        expect(deployConfig).toStrictEqual({
          name: extensionCollection.configuration.name,
          handle: extensionCollection.configuration.handle,
          in_collection: [{handle: 'handle2'}],
        })
      })
    })

    test('returns the deploy config when only includes is passed in', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const configuration = {
          name: 'Order summary',
          handle: 'order-summary-collection',
          includes: ['handle1'],
        }
        const extensionCollection = await getTestEditorExtensionCollection({
          directory: tmpDir,
          configuration,
        })

        const deployConfig = await extensionCollection.deployConfig({
          apiKey: 'apiKey',
          developerPlatformClient,
        })

        expect(deployConfig).toStrictEqual({
          name: extensionCollection.configuration.name,
          handle: extensionCollection.configuration.handle,
          in_collection: [{handle: 'handle1'}],
        })
      })
    })
  })
})
