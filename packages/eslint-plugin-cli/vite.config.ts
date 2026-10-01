import baseConfig from '../../configurations/vite.config'

const config = baseConfig(__dirname, {poolStrategy: 'forks'})

export default {
  ...config,
  test: {
    ...config.test,
    globals: true,
    // RuleTester's large native buffers can exhaust Windows memory when files run concurrently.
    fileParallelism: process.platform !== 'win32',
  },
}
