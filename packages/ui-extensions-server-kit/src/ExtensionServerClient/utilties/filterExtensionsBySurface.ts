import {Surface} from 'ExtensionServerClient/types'
import {ExtensionPoints} from 'types'

interface ExtensionLike {
  surface: Surface
  extensionPoints: ExtensionPoints
  [key: string]: any
}

export function filterExtensionsBySurface<TExtension extends ExtensionLike>(
  extensions: TExtension[],
  surface: Surface | undefined,
): TExtension[] {
  if (!surface) {
    return extensions
  }

  return extensions.filter((extension) => {
    if (extension.surface === surface) {
      return true
    }

    if (Array.isArray(extension.extensionPoints)) {
      const extensionPoints: (string | {surface: Surface; [key: string]: any})[] = extension.extensionPoints
      const extensionPointMatchingSurface = extensionPoints.filter((extensionPoint) => {
        if (typeof extensionPoint === 'string') {
          return false
        }

        return extensionPoint.surface === surface
      })

      return extensionPointMatchingSurface.length > 0
    }

    return false
  })
}
