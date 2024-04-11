import {writeFile} from '../lib/fs.js'
import {Given, After, setDefaultTimeout} from '@cucumber/cucumber'
import tempy from 'tempy'
import rimraf from 'rimraf'
import * as path from 'pathe'

// In the case of debug we want to disable
// the timeouts to be able to sleep the
// execution and debug things.
if (process.env.DEBUG === '1') {
  setDefaultTimeout(-1)
}

Given('I have a working directory', async function () {
  this.temporaryDirectory = tempy.directory()
  const dataHomeDirectory = path.join(this.temporaryDirectory, 'XDG_DATA_HOME')
  const configHomeDirectory = path.join(this.temporaryDirectory, 'XDG_CONFIG_HOME')
  const stateHomeDirectory = path.join(this.temporaryDirectory, 'XDG_STATE_HOME')
  const cacheHomeDirectory = path.join(this.temporaryDirectory, 'XDG_CACHE_HOME')

  this.temporaryEnv = {
    XDG_DATA_HOME: dataHomeDirectory,
    XDG_CONFIG_HOME: configHomeDirectory,
    XDG_STATE_HOME: stateHomeDirectory,
    XDG_CACHE_HOME: cacheHomeDirectory,
  }

  // When we run the acceptance tests in CI, the .npmrc is scoped to the project.
  // Because of that, the projects that we create from acceptance tests fail to
  // install dependencies because the package manager doesn't know which package registry
  // to resolve the packages from. This line mitigates the issue.
  const npmrc = '//registry.npmjs.org/'
  await writeFile(path.join(this.temporaryDirectory, '.npmrc'), npmrc)
})

After(function () {
  if (this.temporaryDirectory) {
    rimraf.sync(this.temporaryDirectory)
  }
})
