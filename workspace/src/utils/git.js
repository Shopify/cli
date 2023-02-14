import {execa} from 'execa'
import * as path from 'pathe'
import git from 'simple-git'
import {logMessage, logSection} from './log.js'

export async function cloneCLIRepository(tmpDir) {
  logSection('Setting up baseline: main branch')
  const directory = path.join(tmpDir, 'cli')
  logMessage('Cloning repository')
  await git().clone('https://github.com/Shopify/cli.git', directory)
  logMessage('Installing dependencies')
  await execa('pnpm', ['install'], {cwd: directory})
  logMessage('Building the project')
  await execa('pnpm', ['build'], {cwd: directory})
  return directory
}
