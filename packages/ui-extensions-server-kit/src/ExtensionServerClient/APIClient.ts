import type {Surface} from './types'

export class APIClient implements ExtensionServer.API.Client {
  constructor(public url: string, public surface?: Surface) {}

  async extensions(): Promise<ExtensionServer.API.ExtensionsResponse> {
    const response = await fetch(this.url)
    const dto: ExtensionServer.API.ExtensionsResponse = await response.json()

    return {...dto, extensions: this.getExtensionsMatchingSurface(dto.extensions)}
  }

  async extensionById(id: string): Promise<ExtensionServer.API.ExtensionResponse> {
    const response = await fetch(`${this.url}/${id}`)
    const dto: ExtensionServer.API.ExtensionResponse = await response.json()
    return dto
  }

  private getExtensionsMatchingSurface(extensions: ExtensionServer.API.ExtensionsResponse['extensions']) {
    return extensions.filter((extension) => {
      if (!this.surface) {
        return true
      }

      if (extension.surface === this.surface) {
        return true
      }

      if (Array.isArray(extension.extensionPoints)) {
        const extensionPoints: (string | {surface: Surface; [key: string]: any})[] = extension.extensionPoints
        const extensionPointMatchingSurface = extensionPoints.filter((extensionPoint) => {
          if (typeof extensionPoint === 'string') {
            return false
          }

          return extensionPoint.surface === this.surface
        })

        return extensionPointMatchingSurface.length > 0
      }

      return false
    })
  }
}
