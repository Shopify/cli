import ngrok from 'ngrok'

export async function create(): Promise<string> {
  return ngrok.connect({addr: 3000})
}
