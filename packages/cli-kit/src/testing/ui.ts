import * as path from '../path.js'
import {ExecaChildProcess, execaNode} from 'execa'

type Run = (fixture: string, props?: {env?: {[key: string]: unknown}}) => ExecaChildProcess<string>

export const run: Run = (fixture, props) => {
  const env = {
    ...process.env,
    ...props?.env,
    // we need this because ink treats the CI environment differently
    // by only writing the last frame to stdout on unmount
    // See more here https://github.com/vadimdemedes/ink/pull/266
    // this way local and CI tests behave the same
    CI: 'true',
  }

  // we want to load the compiled js directly in order avoid unnecessary transpilation
  return execaNode(path.resolve(__dirname, `../../dist/testing/fixtures/${fixture}.js`), {
    cwd: __dirname,
    env,
  })
}
