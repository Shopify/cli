import {execa, ExecaChildProcess} from 'execa'
import {path} from '@shopify/cli-kit'

type Run = (fixture: string, props?: {env?: Record<string, any>}) => ExecaChildProcess<string>

export const run: Run = (fixture, props) => {
  const env = {
    ...process.env,
    ...props?.env,
    // we need this because ink treats the CI environment differently
    // by only writing the last frame to stdout on unmount
    // See more here https://github.com/vadimdemedes/ink/pull/266
    CI: 'false',
  }

  return execa('ts-node-esm', [path.resolve(__dirname, `fixtures/${fixture}.ts`)], {
    cwd: __dirname,
    env,
  })
}
