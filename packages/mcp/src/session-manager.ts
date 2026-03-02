import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {requestDeviceCode, completeDeviceAuth} from '@shopify/cli-kit/node/mcp'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {AdminSession} from '@shopify/cli-kit/node/session'
import type {DeviceCodeResponse} from '@shopify/cli-kit/node/mcp'

export class SessionManager {
  private readonly sessions: Map<string, AdminSession> = new Map()
  private readonly pendingAuth: Map<string, Promise<AdminSession>> = new Map()

  async getSession(store: string): Promise<AdminSession | undefined> {
    const storeFqdn = normalizeStoreFqdn(store)
    const cached = this.sessions.get(storeFqdn)
    if (cached) return cached

    try {
      const session = await ensureAuthenticatedAdmin(storeFqdn, [], {noPrompt: true})
      this.sessions.set(storeFqdn, session)
      return session
    } catch (error) {
      if (error instanceof AbortError) {
        return undefined
      }
      throw error
    }
  }

  async startAuth(store: string): Promise<DeviceCodeResponse> {
    const storeFqdn = normalizeStoreFqdn(store)

    if (this.pendingAuth.has(storeFqdn)) {
      throw new Error(`Authentication already in progress for store ${storeFqdn}.`)
    }

    const deviceCodeResponse = await requestDeviceCode()

    const authPromise = completeDeviceAuth(deviceCodeResponse.deviceCode, deviceCodeResponse.interval, storeFqdn).then(
      (session) => {
        this.sessions.set(storeFqdn, session)
        this.pendingAuth.delete(storeFqdn)
        return session
      },
      (error: unknown) => {
        this.pendingAuth.delete(storeFqdn)
        throw error
      },
    )

    authPromise.catch(() => {})
    this.pendingAuth.set(storeFqdn, authPromise)
    return deviceCodeResponse
  }

  async requireSession(store: string): Promise<AdminSession> {
    const storeFqdn = normalizeStoreFqdn(store)

    const cached = this.sessions.get(storeFqdn)
    if (cached) return cached

    const pending = this.pendingAuth.get(storeFqdn)
    if (pending) return pending

    try {
      const session = await ensureAuthenticatedAdmin(storeFqdn, [], {noPrompt: true})
      this.sessions.set(storeFqdn, session)
      return session
    } catch (error) {
      if (error instanceof AbortError) {
        throw new Error(`Not authenticated for store ${storeFqdn}. Call shopify_auth_login first.`)
      }
      throw error
    }
  }

  clearSession(store: string): void {
    const storeFqdn = normalizeStoreFqdn(store)
    this.sessions.delete(storeFqdn)
    this.pendingAuth.delete(storeFqdn)
  }
}
