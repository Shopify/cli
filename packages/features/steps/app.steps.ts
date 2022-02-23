import {When} from '@cucumber/cucumber'

import {executables} from '../lib/constants'
import {exec} from '../lib/system'

When(
  /I create an extension named (.+) of type (.+)/,
  {timeout: 2 * 60 * 1000},
  async function (extensionName: string, extensionType: string) {
    await exec(executables.cli, [
      'app',
      'scaffold',
      'extension',
      '--name',
      extensionName,
      '--path',
      this.appDirectory,
      '--type',
      extensionType,
    ])
  },
)
