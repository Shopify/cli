import {captureOutputWithExitCode} from './system.js'
import {test, expect} from 'vitest'
import {fileURLToPath} from 'node:url'

test.skipIf(Number(process.versions.node.split('.')[0]) < 26)(
  'does not crash when the npm registry is unreachable',
  async () => {
    const {exitCode, stderr} = await captureOutputWithExitCode(
      'node',
      [
        '--input-type=module',
        '-e',
        `import latestVersion from 'latest-version';
try {
  await latestVersion('shopify-cli-8553-repro');
} catch {}
`,
      ],
      {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: {
          ...process.env,
          npm_config_registry: 'http://127.0.0.1:9',
          NPM_CONFIG_REGISTRY: 'http://127.0.0.1:9',
        },
      },
    )

    expect(exitCode).toBe(0)
    expect(stderr).not.toContain('onCancel handler was attached after the promise settled')
  },
)
