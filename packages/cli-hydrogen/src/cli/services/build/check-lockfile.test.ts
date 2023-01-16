import {checkLockfileStatus} from './check-lockfile.js'
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {file, path, outputMocker} from '@shopify/cli-kit'
import {factory} from '@shopify/cli-kit/node/git'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')

  return {
    ...cliKit,
    git: {
      factory: vi.fn(),
    },
  }
})

describe('checkLockfileStatus()', () => {
  const checkIgnoreMock = vi.fn()
  const gitFactoryMock = {
    checkIgnore: checkIgnoreMock,
  }

  beforeEach(() => {
    vi.mocked(factory).mockReturnValue(gitFactoryMock as any)
    vi.mocked(checkIgnoreMock).mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    outputMocker.mockAndCaptureOutput().clear()
  })

  describe('when a lockfile present', () => {
    it('returns "ok"', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        await file.write(path.join(tmpDir, 'yarn.lock'), '')

        expect(await checkLockfileStatus(tmpDir)).toBe('ok')
      })
    })

    it('does not call displayLockfileWarning', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        await file.write(path.join(tmpDir, 'yarn.lock'), '')
        const outputMock = outputMocker.mockAndCaptureOutput()

        await checkLockfileStatus(tmpDir)

        expect(outputMock.warn()).toBe('')
      })
    })

    describe('and it is being ignored by Git', () => {
      beforeEach(() => {
        vi.mocked(checkIgnoreMock).mockResolvedValue(['yarn.lock'])
      })

      it('returns "ignored"', async () => {
        await file.inTemporaryDirectory(async (tmpDir) => {
          await file.write(path.join(tmpDir, 'yarn.lock'), '')

          expect(await checkLockfileStatus(tmpDir)).toBe('ignored')
        })
      })

      it('renders a warning', async () => {
        await file.inTemporaryDirectory(async (tmpDir) => {
          await file.write(path.join(tmpDir, 'yarn.lock'), '')
          const outputMock = outputMocker.mockAndCaptureOutput()

          await checkLockfileStatus(tmpDir)

          expect(outputMock.warn()).toMatchInlineSnapshot(`
            "
            ╭─ warning ────────────────────────────────────────────────────────────────────╮
            │                                                                              │
            │  Lockfile ignored by Git                                                     │
            │                                                                              │
            │  Your project’s lockfile isn’t being tracked by Git. If you don’t commit a   │
            │  lockfile, then your app might install the wrong package versions when       │
            │  deploying.                                                                  │
            │                                                                              │
            │  Next steps                                                                  │
            │    • In your project’s .gitignore file, delete any references to yarn.lock   │
            │    • Commit the change to your repository                                    │
            │                                                                              │
            ╰──────────────────────────────────────────────────────────────────────────────╯
            "
          `)
        })
      })
    })
  })

  describe('when there are multiple lockfiles', () => {
    it('returns "multiple"', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        await file.write(path.join(tmpDir, 'yarn.lock'), '')
        await file.write(path.join(tmpDir, 'package-lock.json'), '')

        expect(await checkLockfileStatus(tmpDir)).toBe('multiple')
      })
    })

    it('renders a warning', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        await file.write(path.join(tmpDir, 'yarn.lock'), '')
        await file.write(path.join(tmpDir, 'package-lock.json'), '')

        const outputMock = outputMocker.mockAndCaptureOutput()

        await checkLockfileStatus(tmpDir)

        expect(outputMock.warn()).toMatchInlineSnapshot(`
          "
          ╭─ warning ────────────────────────────────────────────────────────────────────╮
          │                                                                              │
          │  Multiple lockfiles found                                                    │
          │                                                                              │
          │  Your project contains more than one lockfile. This can cause version        │
          │  conflicts when installing and deploying your app. The following lockfiles   │
          │  were detected:                                                              │
          │                                                                              │
          │    • yarn.lock (created by yarn)                                             │
          │    • package-lock.json (created by npm)                                      │
          │                                                                              │
          │  Next steps                                                                  │
          │    • Delete any unneeded lockfiles                                           │
          │    • Commit the change to your repository                                    │
          │                                                                              │
          ╰──────────────────────────────────────────────────────────────────────────────╯
          "
        `)
      })
    })
  })

  describe('when a lockfile is missing', () => {
    it('returns "missing"', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        expect(await checkLockfileStatus(tmpDir)).toBe('missing')
      })
    })

    it('renders a warning', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        const outputMock = outputMocker.mockAndCaptureOutput()

        await checkLockfileStatus(tmpDir)

        expect(outputMock.warn()).toMatchInlineSnapshot(`
          "
          ╭─ warning ────────────────────────────────────────────────────────────────────╮
          │                                                                              │
          │  No lockfile found                                                           │
          │                                                                              │
          │  If you don’t commit a lockfile, then your app might install the wrong       │
          │  package versions when deploying. To avoid versioning issues, generate a     │
          │  new lockfile and commit it to your repository.                              │
          │                                                                              │
          │  Next steps                                                                  │
          │    • Generate a lockfile. Run \`npm|yarn|pnpm install\`                        │
          │    • Commit the new file to your repository                                  │
          │                                                                              │
          ╰──────────────────────────────────────────────────────────────────────────────╯
          "
        `)
      })
    })
  })
})
