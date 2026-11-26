import {checkTheme, outputActiveChecks, outputActiveConfig} from '../check.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import * as themeCheckNode from '@shopify/theme-check-node'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/output')>()),
  outputResult: vi.fn(),
}))

test.each([
  ['checkTheme', checkTheme],
  ['outputActiveConfig', outputActiveConfig],
  ['outputActiveChecks', outputActiveChecks],
] as const)('%s reports an unknown config extended by the default config', async (_name, operation) => {
  await inTemporaryDirectory(async (root) => {
    await writeFile(joinPath(root, '.theme-check.yml'), 'extends: theme-check:shopify\n')

    const result = operation(root)

    await expect(result).rejects.toBeInstanceOf(AbortError)
    await expect(result).rejects.toThrow('Unknown Theme Check config: theme-check:shopify')
    await expect(result).rejects.toMatchObject({
      tryMessage: expect.stringContaining(themeCheckNode.ModernIdentifiers.join(', ')),
    })
  })
})

test('reports an unknown config passed explicitly', async () => {
  await inTemporaryDirectory(async (root) => {
    const result = checkTheme(root, 'theme-check:shopify')

    await expect(result).rejects.toBeInstanceOf(AbortError)
    await expect(result).rejects.toThrow('Unknown Theme Check config: theme-check:shopify')
  })
})

test.each(['C:\\theme\\theme-check:shopify', 'C:/theme/theme-check:shopify'])(
  'reports an unknown identifier when readFile returns an absolute path: %s',
  async (configPath) => {
    await inTemporaryDirectory(async (root) => {
      const failure = Object.assign(new Error('ENOENT'), {code: 'ENOENT', syscall: 'open', path: configPath})
      vi.spyOn(themeCheckNode, 'themeCheckRun').mockRejectedValueOnce(failure)

      const result = checkTheme(root)

      await expect(result).rejects.toBeInstanceOf(AbortError)
      await expect(result).rejects.toThrow('Unknown Theme Check config: theme-check:shopify')
    })
  },
)

test.each([undefined, 'custom.yml'])('reports a missing extended config with --config=%s', async (config) => {
  await inTemporaryDirectory(async (root) => {
    const configPath = joinPath(root, config ?? '.theme-check.yml')
    const missingPath = joinPath(root, 'missing.yml')
    await writeFile(configPath, 'extends: ./missing.yml\n')

    const result = checkTheme(root, config ? configPath : undefined)

    await expect(result).rejects.toBeInstanceOf(AbortError)
    await expect(result).rejects.toThrow(`Theme Check config file not found: ${missingPath}`)
  })
})

test('normalizes native separators in missing extended config paths', async () => {
  await inTemporaryDirectory(async (root) => {
    const missingPath = joinPath(root, 'missing.yml')
    await writeFile(joinPath(root, '.theme-check.yml'), 'extends: ./missing.yml\n')
    const failure = Object.assign(new Error('ENOENT'), {
      code: 'ENOENT',
      syscall: 'open',
      path: missingPath.replaceAll('/', '\\'),
    })
    vi.spyOn(themeCheckNode, 'themeCheckRun').mockRejectedValueOnce(failure)

    const result = checkTheme(root)

    await expect(result).rejects.toBeInstanceOf(AbortError)
    await expect(result).rejects.toThrow(`Theme Check config file not found: ${missingPath}`)
  })
})

test('reports a missing config extended by another extended config', async () => {
  await inTemporaryDirectory(async (root) => {
    await writeFile(joinPath(root, '.theme-check.yml'), 'extends: ./base.yml\n')
    await writeFile(joinPath(root, 'base.yml'), 'extends: ./missing.yml\n')

    const result = checkTheme(root)

    await expect(result).rejects.toBeInstanceOf(AbortError)
    await expect(result).rejects.toThrow(`Theme Check config file not found: ${joinPath(root, 'missing.yml')}`)
  })
})

test.each(themeCheckNode.ModernIdentifiers)('still loads the built-in config %s', async (identifier) => {
  await inTemporaryDirectory(async (root) => {
    await writeFile(joinPath(root, '.theme-check.yml'), `extends: ${identifier}\n`)

    await outputActiveConfig(root)

    expect(outputResult).toHaveBeenCalledWith(expect.any(String))
  })
})

test.each(['extends: theme-check:nothing\n', 'extends: ./missing.yml\n', 'extends: [\n'])(
  'preserves an unrelated missing theme file error when the config contains %s',
  async (config) => {
    await inTemporaryDirectory(async (root) => {
      await writeFile(joinPath(root, '.theme-check.yml'), config)
      const failure = Object.assign(new Error('ENOENT'), {
        code: 'ENOENT',
        syscall: 'open',
        path: joinPath(root, 'templates/index.liquid'),
      })
      vi.spyOn(themeCheckNode, 'themeCheckRun').mockRejectedValueOnce(failure)

      await expect(checkTheme(root)).rejects.toBe(failure)
    })
  },
)

test('does not treat a missing theme root as a missing config', async () => {
  await inTemporaryDirectory(async (root) => {
    const result = checkTheme(joinPath(root, 'missing-theme'))

    await expect(result).rejects.toMatchObject({code: 'ENOENT'})
    await expect(result).rejects.not.toBeInstanceOf(AbortError)
  })
})
