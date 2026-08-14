let commandSessionId: string | undefined

export function getCommandSessionId(): string | undefined {
  return commandSessionId
}

export function setCommandSessionId(sessionId: string | undefined): void {
  commandSessionId = sessionId
}
