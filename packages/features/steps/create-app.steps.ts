import {executables} from '../lib/constants'
import {exec} from '../lib/system'
import {When, Then} from '@cucumber/cucumber'
import path from 'pathe'
import {strict as assert} from 'assert'

When(
  /I create an app named (.+) with (.+) as dependency manager/,
  {timeout: 5 * 60 * 1000},
  async function (appName: string, dependencyManager: string) {
    const {stdout} = await exec(
      'node',
      [
        executables.createApp,
        '--name',
        appName,
        '--path',
        this.temporaryDirectory,
        '--dependency-manager',
        dependencyManager,
        '--local',
        '--template',
        'https://github.com/Shopify/shopify-app-template-node#richard/frontend-via-submodules-toml-updates',
      ],
      {env: {...process.env, ...this.temporaryEnv}},
    )
    const hyphenatedAppName = stdout.match(/Initializing your app ([\w-]+)/)[1]
    this.appDirectory = path.join(this.temporaryDirectory, hyphenatedAppName)
  },
)

Then(
  /I have an app named (.+) scaffolded from the template with (.+) as dependency manager/,
  {},
  async function (appName: string, dependencyManager: string) {
    const {stdout} = await exec(executables.cli, ['app', 'info', '--path', this.appDirectory, '--json'], {
      env: {...process.env, ...this.temporaryEnv},
    })
    const results = JSON.parse(stdout)
    assert.equal(results.dependencyManager, dependencyManager)
  },
)

Then(/I can build the app/, {timeout: 2 * 60 * 1000}, async function () {
  await exec('node', [executables.cli, 'app', 'build', '--path', this.appDirectory], {
    env: {...process.env, ...this.temporaryEnv},
  })
})
