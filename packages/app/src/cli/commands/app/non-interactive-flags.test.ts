import ConfigLink from './config/link.js'
import Deploy from './deploy.js'
import FunctionReplay from './function/replay.js'
import AppGenerateExtension from './generate/extension.js'
import Init from './init.js'
import Release from './release.js'
import WebhookTrigger from './webhook/trigger.js'
import {describe, expect, test} from 'vitest'

describe('non-interactive app command flags', () => {
  test.each([
    {command: ConfigLink, flag: 'client-id'},
    {command: FunctionReplay, flag: 'log'},
    {command: AppGenerateExtension, flag: 'template'},
    {command: AppGenerateExtension, flag: 'name'},
    {command: Init, flag: 'template'},
    {command: WebhookTrigger, flag: 'api-version'},
    {command: WebhookTrigger, flag: 'topic'},
    {command: WebhookTrigger, flag: 'address'},
  ])('$command.name marks --$flag as required', ({command, flag}) => {
    const flags = command.flags as Record<string, {description?: string; requiredIfNonInteractive?: boolean}>
    expect(flags[flag]!.requiredIfNonInteractive).toBe(true)
    expect(flags[flag]!.description).toMatch(/Required if non interactive\.$/)
  })

  test('app deploy accepts any flag that skips confirmation', () => {
    expect(Deploy.nonTTYFlagRequirements()).toEqual([{flags: ['allow-updates', 'allow-deletes', 'no-release']}])
  })

  test('app generate extension documents its template-dependent flavor requirement', () => {
    expect(AppGenerateExtension.flags.flavor.description).toMatch(
      /Required if non interactive when the selected extension template supports multiple flavors\.$/,
    )
  })

  test('app release accepts either flag that skips confirmation', () => {
    expect(Release.nonTTYFlagRequirements()).toEqual([{flags: ['allow-updates', 'allow-deletes']}])
  })
})
