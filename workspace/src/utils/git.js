import {execa} from 'execa'
import * as path from 'pathe'
import git from 'simple-git'
import {logMessage, logSection} from './log.js'

/**
 * Clone the Shopify/cli repository into `tmpDir/cli` and check out `ref`.
 *
 * `ref` defaults to `main` to preserve historical behavior. Callers that
 * want to diff against the merge-base of a PR (rather than against the
 * current tip of `main`) should pass the merge-base SHA explicitly so the
 * baseline reflects the actual fork point and not whatever has landed on
 * `main` since the PR was opened.
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
 * @param {{install?: boolean, build?: boolean, ref?: string}} [options]
 * @returns {Promise<string>} path to the cloned repository
 */
export async function cloneCLIRepository(tmpDir, {install = true, build = true, ref = 'main'} = {}) {
  logSection(`Setting up baseline: ${ref}`)
  const directory = path.join(tmpDir, 'cli')
  logMessage('Cloning repository')
  // Full clone (no `--depth`) so any historical SHA passed as `ref` is
  // reachable. Shopify/cli's history is small enough that this is fast
  // and the clone is throwaway.
  await git().clone('https://github.com/Shopify/cli.git', directory)
  if (ref !== 'main') {
    logMessage(`Checking out ${ref}`)
    await git(directory).checkout(ref)
  }
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

