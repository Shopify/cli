interface CreateOptions {
  port: number
  authToken: string
}

export async function create(options: CreateOptions): Promise<string> {
  const ngrok = await import("ngrok")
  await ngrok.kill()
  return ngrok.connect({proto: 'http', addr: options.port, authtoken: options.authToken})
}
