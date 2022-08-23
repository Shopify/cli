import type {Surface} from './types'

export class APIClient implements ExtensionServer.API.Client {
  constructor(public url: string, public surface?: Surface) {}

  async extensions(): Promise<ExtensionServer.API.ExtensionsResponse> {
    console.log("THIS.URL:", this.url)
    const response = await fetch(this.url)
    console.log("THAT.URL:", this.url)
    const dto: ExtensionServer.API.ExtensionsResponse = await response.json()
    const filteredExtensions = dto.extensions.filter((extension) => !this.surface || extension.surface === this.surface)
    return {...dto, extensions: filteredExtensions}
  }

  async extensionById(id: string): Promise<ExtensionServer.API.ExtensionResponse> {
    const response = await fetch(`${this.url}/${id}`)
    const dto: ExtensionServer.API.ExtensionResponse = await response.json()
    return dto
  }
}
