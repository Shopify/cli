import {Then} from '@cucumber/cucumber'
import * as path from 'pathe'
import fs from 'fs'
import {strict as assert} from 'assert'

Then(/I see Theme's help menu/, {timeout: 60 * 1000}, async function () {
  await this.execCLI(['theme', 'help-old'])
})

Then(/I have Ruby CLI installed as a vendor dependency/, {}, async function () {
  const cacheHome = this.temporaryEnv.XDG_CACHE_HOME
  const cliPath = path.join(cacheHome, 'vendor', 'ruby-cli')
  const exists = fs.existsSync(cliPath)
  assert.equal(exists, true)
})
