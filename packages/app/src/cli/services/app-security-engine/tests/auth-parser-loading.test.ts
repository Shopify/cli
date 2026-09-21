import {scanRouteAuthentication} from '../rules/auth-rules.js'
import {expect, test, vi} from 'vitest'

test('hands any native package import rejection to agent review', async () => {
  vi.doMock('@ast-grep/napi', () => {
    throw new Error('WASI binding not found and NAPI_RS_FORCE_WASI is set to error')
  })
  try {
    const result = await scanRouteAuthentication([
      {
        path: 'app/routes/health.ts',
        absolutePath: '/app/app/routes/health.ts',
        ext: '.ts',
        content: 'export const loader = () => null;',
      },
    ])
    expect(result).toMatchObject({
      issues: [],
      inspectedFiles: [],
      unresolvedReasonCode: 'parser_unavailable',
    })
  } finally {
    vi.doUnmock('@ast-grep/napi')
    vi.resetModules()
  }
})
