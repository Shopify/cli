import {resolve as resolveCliKitSource} from '../../../cli-kit/test/fixtures/cli-kit-source-loader.js'

const serviceUrl = new URL('../../src/cli/services/dev.ts', import.meta.url).href
const environmentUrl = new URL('../../src/cli/utilities/theme-environment/theme-environment.ts', import.meta.url).href
const htmlUrl = new URL('../../src/cli/utilities/theme-environment/html.ts', import.meta.url).href
const dependencies = new Set([
  '../utilities/theme-fs.js',
  '../utilities/theme-ui.js',
  '../utilities/theme-environment/theme-environment.js',
  '../utilities/theme-environment/storefront-session.js',
  '../utilities/theme-environment/storefront-password-prompt.js',
  '../utilities/theme-fs-empty.js',
  '../utilities/theme-environment/dev-server-session.js',
  '../utilities/theme-environment/crawler-signature.js',
  '../utilities/theme-listing.js',
])

// Use the real service and CLI Kit sources; replace only remote theme setup.
export function resolve(specifier, context, nextResolve) {
  if (process.env.THEME_DEV_TEST_STAGE === 'preview') {
    if (context.parentURL === serviceUrl && specifier === '../utilities/theme-environment/theme-environment.js') {
      return nextResolve(specifier, context)
    }
    if (
      (context.parentURL === environmentUrl &&
        ['../theme-uploader.js', '@shopify/cli-kit/node/themes/api'].includes(specifier)) ||
      (context.parentURL === htmlUrl && specifier === './storefront-renderer.js')
    ) {
      return nextResolve(new URL('./dev-instance-preview.js', import.meta.url).href, context)
    }
  }
  if (context.parentURL === serviceUrl && dependencies.has(specifier)) {
    return nextResolve(new URL('./dev-instance-dependencies.js', import.meta.url).href, context)
  }
  return resolveCliKitSource(specifier, context, nextResolve)
}
