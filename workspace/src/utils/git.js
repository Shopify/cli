import {execa} from 'execa'
import * as path from 'pathe'
import git from 'simple-git'
import {logMessage, logSection} from './log.js'

/**
 * Clone the Shopify/cli `main` branch into `tmpDir/cli`.
 *
 * `install` and `build` default to `true` to preserve behavior for
 * `type-diff.js`, which diffs `dist/**\/*.d.ts` and therefore needs the
 * baseline built. Pass `{install: false, build: false}` from callers that
 * only consume git-tracked sources or committed artifacts (e.g.
 * `major-change-check.js`, which reads `oclif.manifest.json` and `.ts`
 * source files only). Skipping install+build saves ~5–10 minutes of CI per
 * PR for those callers.
 *
 * @param {string} tmpDir
 * @param {{install?: boolean, build?: boolean}} [options]
 * @returns {Promise<string>} path to the cloned repository
 */
export async function cloneCLIRepository(tmpDir, {install = true, build = true} = {}) {
  logSection('Setting up baseline: main branch')
  const directory = path.join(tmpDir, 'cli')
  logMessage('Cloning repository')
  await git().clone('https://github.com/Shopify/cli.git', directory)
  if (install) {
    logMessage('Installing dependencies')
    await execa('pnpm', ['install'], {cwd: directory})
  }
  if (build) {
    logMessage('Building the project')
    await execa('pnpm', ['build'], {cwd: directory})
  }
  return directory
}
