import {DEV_MCP_STDERR_SILENCER, buildDevMcpLaunch} from './dev-mcp-launch.js'
import {describe, expect, test} from 'vitest'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('buildDevMcpLaunch', () => {
  test('runs the silencer via node -e with the entry as the final positional argument', () => {
    const {command, args} = buildDevMcpLaunch('/path/to/dev-mcp/dist/index.js')

    expect(command).toBe(process.execPath)
    expect(args).toEqual(['-e', DEV_MCP_STDERR_SILENCER, '/path/to/dev-mcp/dist/index.js'])
  })
})

describe('DEV_MCP_STDERR_SILENCER', () => {
  test('discards the child banner, opts out of instrumentation, and passes the JSON-RPC channel through', async () => {
    await inTemporaryDirectory(async (dir) => {
      const fakeEntry = joinPath(dir, 'fake-dev-mcp.js')

      // Stands in for dev-mcp: emits the same shape of noise (a startup banner on stderr and an
      // env-gated telemetry marker on stdout), then proves the stdio pipes are still wired through by
      // echoing back whatever it receives on stdin.
      await writeFile(
        fakeEntry,
        `
        process.stderr.write('FAKE_MCP_BANNER\\n')
        process.stdout.write('OPT_OUT=' + process.env.OPT_OUT_INSTRUMENTATION + '\\n')
        process.stdin.once('data', (chunk) => {
          process.stdout.write(chunk, () => process.exit(0))
        })
        `,
      )

      const {command, args} = buildDevMcpLaunch(fakeEntry)
      const result = await captureOutputWithExitCode(command, args, {input: 'PROBE'})

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('OPT_OUT=true')
      expect(result.stdout).toContain('PROBE')
      expect(result.stderr).toBe('')
    })
  })
})
