import baseConfig from '../../configurations/vite.config'
import {defineConfig} from 'vitest/config'

const config = defineConfig(async () => {
  const sharedConfig = await baseConfig(__dirname, {poolStrategy: 'forks'})
  return {
    ...sharedConfig,
    test: {
      ...sharedConfig.test,
      globals: true,
      // RuleTester's large native buffers can exhaust Windows memory when files run concurrently.
      fileParallelism: process.platform !== 'win32',
    },
  }
})

export default config
