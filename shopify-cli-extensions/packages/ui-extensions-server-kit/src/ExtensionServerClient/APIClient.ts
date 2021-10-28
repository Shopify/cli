export class APIClient implements ExtensionServer.API.Client {
  constructor(public url: string) {}

  async extensions(): Promise<ExtensionServer.API.ExtensionsResponse> {
    const response = await fetch(`${this.url}/extensions`);
    const dto: ExtensionServer.API.ExtensionsResponse = await response.json();
    return dto;
  }

  async extensionById(id: string): Promise<ExtensionServer.API.ExtensionResponse> {
    const response = await fetch(`${this.url}/extensions/${id}`);
    const dto: ExtensionServer.API.ExtensionResponse = await response.json();
    return dto;
  }
}
