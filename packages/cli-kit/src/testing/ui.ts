import * as path from '../path'
import {execa, ExecaChildProcess} from 'execa'

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

  return execa(
    path.resolve(__dirname, '../../../../node_modules/.bin/ts-node-esm'),
    [path.resolve(__dirname, `fixtures/${fixture}.ts`)],
    {
      cwd: __dirname,
      env,
    },
  )
}
