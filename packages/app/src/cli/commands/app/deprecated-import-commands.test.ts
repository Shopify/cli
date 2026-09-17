import ImportExtensions from './import-extensions.js'
import ImportCustomDataDefinitionsDeprecated from './import-custom-data-definitions.js'
import ImportDashboardExtensions from './import/dashboard-extensions.js'
import ImportCustomDataDefinitions from './import/custom-data-definitions.js'
import {linkedAppContext} from '../../services/app-context.js'
import {getExtensions} from '../../services/fetch-extensions.js'
import {testAppLinked, testOrganizationApp} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/app-context.js')
vi.mock('../../services/fetch-extensions.js')

// Banners wrap their contents to the terminal width, so assertions run against a single flat line.
function unwrap(output: string): string {
  return output.replace(/[│╭╮╰╯─]/g, ' ').replace(/\s+/g, ' ')
}

describe('deprecated import command paths', () => {
  test.each([
    {deprecated: ImportExtensions, replacement: ImportDashboardExtensions},
    {deprecated: ImportCustomDataDefinitionsDeprecated, replacement: ImportCustomDataDefinitions},
  ])('$deprecated.name is hidden and keeps the flags of its replacement', ({deprecated, replacement}) => {
    expect(deprecated.hidden).toBe(true)
    expect(replacement.hidden).toBeFalsy()
    expect(deprecated.flags).toEqual(replacement.flags)
    expect(deprecated.baseFlags).toEqual(replacement.baseFlags)
  })

  test.each([
    {deprecated: ImportExtensions, replacement: ImportDashboardExtensions},
    {deprecated: ImportCustomDataDefinitionsDeprecated, replacement: ImportCustomDataDefinitions},
  ])('$deprecated.name declares flags as own statics so the manifest keeps them', ({deprecated}) => {
    // oclif's manifest builder stops walking the prototype chain at `AppLinkedCommand`, so
    // inherited flags would silently vanish from the manifest.
    expect(Object.hasOwn(deprecated, 'flags')).toBe(true)
    expect(Object.hasOwn(deprecated, 'baseFlags')).toBe(true)
  })

  test('app import-extensions warns about the new path and still runs the command', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const app = testAppLinked()
      vi.mocked(linkedAppContext).mockResolvedValue({
        app,
        remoteApp: testOrganizationApp(),
      } as Awaited<ReturnType<typeof linkedAppContext>>)
      vi.mocked(getExtensions).mockResolvedValue([])
      const outputMock = mockAndCaptureOutput()

      await ImportExtensions.run(['--path', tmp], import.meta.url)

      expect(unwrap(outputMock.warn())).toContain(
        '`shopify app import-extensions` has moved. This command will be removed in a future release. ' +
          'Use `shopify app import dashboard-extensions` instead.',
      )
      expect(getExtensions).toHaveBeenCalled()
      expect(outputMock.info()).toMatch(/No extensions to migrate/)
    })
  })
})
