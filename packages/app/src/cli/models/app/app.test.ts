import {getUIExtensionRendererVersion} from './app.js'
import {testApp, testUIExtension} from './app.test-data.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

const DEFAULT_APP = testApp()

describe('getUIExtensionRendererVersion', () => {
  test('returns the version of the dependency package for product_subscription', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'admin-ui-extensions', '2.4.5')
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'product_subscription'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).not.toEqual('not-found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/admin-ui-extensions')
      expect(got?.version).toEqual('2.4.5')
    })
  })

  test('returns the version of the dependency package for checkout_ui_extension', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'checkout-ui-extensions', '1.4.5')
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'checkout_ui_extension'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).not.toEqual('not-found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/checkout-ui-extensions')
      expect(got?.version).toEqual('1.4.5')
    })
  })

  test('returns the version of the dependency package for checkout_post_purchase', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, 'post-purchase-ui-extensions', '3.4.5')
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'checkout_post_purchase'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).not.toEqual('not-found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/post-purchase-ui-extensions')
      expect(got?.version).toEqual('3.4.5')
    })
  })

  test('returns the version of the dependency package for web_pixel', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createPackageJson(tmpDir, '@shopify/web-pixels-extension', '3.4.5')
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'web_pixel_extension'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).not.toEqual('not-found')
      if (got === 'not_found') return
      expect(got?.name).to.toEqual('@shopify/web-pixels-extension')
      expect(got?.version).toEqual('3.4.5')
    })
  })

  test('returns not_found if there is no renderer package', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      DEFAULT_APP.directory = tmpDir
      const extension = await testUIExtension({type: 'product_subscription'})

      // When
      const got = await getUIExtensionRendererVersion(extension, DEFAULT_APP)

      // Then
      expect(got).toEqual('not_found')
    })
  })
})

function createPackageJson(tmpDir: string, type: string, version: string) {
  const packagePath = joinPath(tmpDir, 'node_modules', '@shopify', type, 'package.json')
  const packageJson = {name: 'name', version}
  const dirPath = joinPath(tmpDir, 'node_modules', '@shopify', type)
  return mkdir(dirPath).then(() => writeFile(packagePath, JSON.stringify(packageJson)))
}
