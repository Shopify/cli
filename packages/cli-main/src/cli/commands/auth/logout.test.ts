import Logout from './logout'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {session, store} from '@shopify/cli-kit'

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const module: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...module,
      session: {
        ...module.session,
        logout: vi.fn(),
      },
      store: {
        ...module.store,
        clearAllAppInfo: vi.fn(),
      },
    }
  })
})

describe('logs out', () => {
  it('removes session', async () => {
    await Logout.run()

    expect(session.logout).toHaveBeenCalledOnce()
  })

  it('removes all app information', async () => {
    await Logout.run()

    expect(store.clearAllAppInfo).toHaveBeenCalledOnce()
  })
})
