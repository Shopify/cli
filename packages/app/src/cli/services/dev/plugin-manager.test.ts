import {lookupTunnelPlugin} from './plugin-manager'
import {describe, expect, it} from 'vitest'
import {Plugin} from '@oclif/core/lib/interfaces'
import {file, path} from '@shopify/cli-kit'

describe('lookupTunnelPlugin', () => {
  it('returns undefined when there are no tunnel plugins ', async () => {
    // Given
    const otherPluginMock = {name: '@shopify/cli-plugin-other'} as Plugin
    const plugins: Plugin[] = [otherPluginMock]

    // When
    const got = await lookupTunnelPlugin(plugins)

    // Then
    expect(got).toBeUndefined()
  })

  it('returns undefined if the tunnel module fails be imported', async () => {
    // Given
    const ngrokPluginMock = {name: '@shopify/plugin-ngrok', root: 'wrongPath'} as Plugin
    const plugins: Plugin[] = [ngrokPluginMock]

    // When
    const got = await lookupTunnelPlugin(plugins)

    // Then
    expect(got).toBeUndefined()
  })

  it('returns the tunnel module when the ngrok plugin is present', async () => {
    // Given
    const tmpDir = await file.mkTmpDir()
    const distDir = path.join(tmpDir, 'dist')
    await file.mkdir(distDir)
    const tunnelFile = path.join(distDir, 'tunnel.js')
    await file.write(
      tunnelFile,
      'export async function start(options) { return Promise.resolve(options.port.toString()) }',
    )

    const root = path.join(process.cwd(), tmpDir)
    const ngrokPluginMock = {name: '@shopify/plugin-ngrok', root} as Plugin
    const plugins: Plugin[] = [ngrokPluginMock]

    // When
    const got = await lookupTunnelPlugin(plugins)

    // Then
    await expect(got?.start({port: 3000})).resolves.toBe('3000')
    await file.rmdir(tmpDir)
  })
})
