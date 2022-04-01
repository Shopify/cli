import ngrok from 'ngrok'

export async function authToken(token: string) {
  await ngrok.authtoken(token)
}

export async function create(): Promise<string> {
  return ngrok.connect({addr: 3000})
}
