/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {Given, After, BeforeAll, setDefaultTimeout} from '@cucumber/cucumber'
import tempy from 'tempy'
import rimraf from 'rimraf'
import path from 'pathe'

import {directories} from '../lib/constants'
import {exec} from '../lib/system'
import {writeFile} from '../lib/fs'

// In the case of debug we want to disable
// the timeouts to be able to sleep the
// execution and debug things.
if (process.env.DEBUG === '1') {
  setDefaultTimeout(-1)
}

Given('I have a working directory', async function () {
  const npmrc = '//registry.npmjs.org/'
  this.temporaryDirectory = tempy.directory()
  await writeFile(path.join(this.temporaryDirectory, '.npmrc'), npmrc)
})

After(function () {
  if (this.temporaryDirectory) {
    rimraf.sync(this.temporaryDirectory, {force: true})
  }
})

/**
 * Before running the acceptance tests, we
 */
BeforeAll({timeout: 2 * 60 * 1000}, async function () {
  console.log('Building CLIs before running tests...')
  await exec('yarn', ['build'], {cwd: directories.root})
})
