import ngrok from 'ngrok'

export async function authToken(token: string) {
  await ngrok.authtoken(token)
}

interface CreateOptions {
  port: number
}

export async function create(options: CreateOptions): Promise<string> {
  return ngrok.connect({addr: options.port})
}
