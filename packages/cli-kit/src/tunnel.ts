import ngrok from 'ngrok'

interface CreateOptions {
  port: number
  authToken: string
}

export async function create(options: CreateOptions): Promise<string> {
  await ngrok.kill()
  return ngrok.connect({proto: 'http', addr: options.port, authtoken: options.authToken})
}
