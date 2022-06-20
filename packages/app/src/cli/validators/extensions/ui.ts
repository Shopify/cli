import {UIExtension} from '../../models/app/app'
import {error} from '@shopify/cli-kit'

const WebPixelConfigError = (property: string) => {
  return new error.Abort(
    `The Web Pixel Extension configuration is missing the key "${property}"`,
    `Please update your shopify.ui.extension.toml to include a valid "${property}"`,
  )
}

export function validateUIExtensions(extensions: UIExtension[]) {
  for (const extension of extensions) {
    switch (extension.type) {
      case 'web_pixel_extension':
        validateWebPixelConfig(extension)
        break
      default:
        break
    }
  }
}

export function validateWebPixelConfig(extension: UIExtension) {
  if (!extension.configuration.runtimeContext) {
    throw WebPixelConfigError('runtime_context')
  }

  if (!extension.configuration.configuration) {
    throw WebPixelConfigError('configuration')
  }
}
