import uiExtensionSpec from './ui_extension.js'
import checkoutPostPurchaseSpec from './checkout_post_purchase.js'
import checkoutUiExtensionSpec from './checkout_ui_extension.js'
import posUiExtensionSpec from './pos_ui_extension.js'
import productSubscriptionSpec from './product_subscription.js'
import webPixelExtensionSpec from './web_pixel_extension.js'
import {ExtensionInstance} from '../extension-instance.js'
import {ExtensionBuildOptions} from '../../../services/build/extension.js'
import {describe, expect, test, vi} from 'vitest'
import {Writable} from 'stream'

vi.mock('../../../services/build/extension.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../services/build/extension.js')>()
  return {...original, buildUIExtension: vi.fn().mockResolvedValue(undefined)}
})

const UI_SPECS = [
  {name: 'ui_extension', spec: uiExtensionSpec},
  {name: 'checkout_post_purchase', spec: checkoutPostPurchaseSpec},
  {name: 'checkout_ui_extension', spec: checkoutUiExtensionSpec},
  {name: 'pos_ui_extension', spec: posUiExtensionSpec},
  {name: 'product_subscription', spec: productSubscriptionSpec},
  {name: 'web_pixel_extension', spec: webPixelExtensionSpec},
]

describe('UI extension build configs', () => {
  for (const {name, spec} of UI_SPECS) {
    describe(name, () => {
      test('uses build_steps mode', () => {
        expect(spec.buildConfig.mode).toBe('ui')
      })

      test('has bundle-ui and copy-static-assets steps', () => {
        if (spec.buildConfig.mode === 'none') throw new Error('Expected build_steps mode')

        const {steps} = spec.buildConfig

        expect(steps).toHaveLength(2)
        expect(steps[0]).toMatchObject({id: 'bundle-ui', type: 'bundle_ui'})
        expect(steps[1]).toMatchObject({id: 'copy-static-assets', type: 'copy_static_assets'})
      })

      test('config is serializable to JSON', () => {
        if (spec.buildConfig.mode === 'none') throw new Error('Expected build_steps mode')

        const serialized = JSON.stringify(spec.buildConfig)
        const deserialized = JSON.parse(serialized)

        expect(deserialized.steps).toHaveLength(2)
        expect(deserialized.steps[0].type).toBe('bundle_ui')
        expect(deserialized.steps[1].type).toBe('copy_static_assets')
      })
    })
  }

  describe('bundle-ui step invokes buildUIExtension', () => {
    test('calls buildUIExtension with extension and options', async () => {
      const {buildUIExtension} = await import('../../../services/build/extension.js')

      const extension = new ExtensionInstance({
        configuration: {name: 'ui-ext', type: 'product_subscription', metafields: []},
        configurationPath: '',
        directory: '/tmp/ext',
        specification: uiExtensionSpec,
      })

      const copyStaticAssetsSpy = vi.spyOn(extension, 'copyStaticAssets').mockResolvedValue(undefined)

      const buildOptions: ExtensionBuildOptions = {
        stdout: new Writable({
          write(chunk, enc, cb) {
            cb()
          },
        }),
        stderr: new Writable({
          write(chunk, enc, cb) {
            cb()
          },
        }),
        app: {} as any,
        environment: 'production',
      }

      await extension.build(buildOptions)

      expect(buildUIExtension).toHaveBeenCalledWith(extension, buildOptions)
      expect(copyStaticAssetsSpy).toHaveBeenCalled()
    })
  })
})
