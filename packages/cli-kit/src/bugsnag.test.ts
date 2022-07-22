import {cleanStackFrameFilePath} from './bugsnag.js'
import {describe, expect, it} from 'vitest'

describe('bugsnag', () => {
  it.each([
    ['plugin in project', 'node_modules/@plugin/name/foo/bar.ts', '@plugin/name/foo/bar.ts'],
    ['plugin outside project', '/global/node_modules/@plugin/global/foo/bar.ts', '@plugin/global/foo/bar.ts'],
    ['some relative path', 'users/own/code.ts', 'users/own/code.ts'],
    ['some absolute path', '/global/code.ts', '/global/code.ts'],
    [
      'plugin in a complex location',
      'node_modules/.something/@plugin+complex/@plugin/complex-path/foo/bar.ts',
      '@plugin/complex-path/foo/bar.ts',
    ],
  ])('%s', (_, path, result) => {
    expect(
      cleanStackFrameFilePath(path, '/my/project', [
        {
          name: '@plugin/name',
          pluginPath: '/my/project/node_modules/@plugin/name',
        },
        {
          name: '@plugin/global',
          pluginPath: '/global/node_modules/@plugin/global',
        },
        {
          name: '@plugin/complex-path',
          pluginPath: '/my/project/node_modules/.something/@plugin+complex/@plugin/complex-path',
        },
      ]),
    ).toEqual(result)
  })
})
