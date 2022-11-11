// TODO: We should be using the types fro @shopify/api.
// However, there are some issues with the types so I copied and pasted the types here to not block the prototype.

interface OnlineAccessInfo {
  expires_in: number
  associated_user_scope: string
  associated_user: {
    id: number
    first_name: string
    last_name: string
    email: string
    email_verified: boolean
    account_owner: boolean
    locale: string
    collaborator: boolean
  }
}

interface Session {
  readonly id: string
  shop: string
  state: string
  isOnline: boolean
  scope?: string
  expires?: Date
  accessToken?: string
  onlineAccessInfo?: OnlineAccessInfo
  isActive(): boolean
}

interface SessionStorage {
  storeSession(session: Session): Promise<boolean>
  loadSession(id: string): Promise<Session | undefined>
  deleteSession(id: string): Promise<boolean>
  deleteSessions?(ids: string[]): Promise<boolean>
  findSessionsByShop?(shop: string): Promise<Session[]>
}

export class RedisStorage implements SessionStorage {
  constructor(url: string) {}

  storeSession(session: Session): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  loadSession(id: string): Promise<Session | undefined> {
    throw new Error('Method not implemented.')
  }

  deleteSession(id: string): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  deleteSessions?(ids: string[]): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  findSessionsByShop?(shop: string): Promise<Session[]> {
    throw new Error('Method not implemented.')
  }
}

function defineAuthStorage(storage: (options: {development: boolean}) => SessionStorage) {
  return storage
}

export {Session, SessionStorage, defineAuthStorage}
