import baseConfig from '../../configurations/vite.config'

const config = baseConfig(__dirname)

export default {
  ...config,
  test: {
    ...config.test,
    globals: true,
  },
}
