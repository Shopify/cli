import {platform} from 'os'

const featureToRun = process.env.FEATURE

const result = {
  publishQuiet: true,
  import: ['world/**/*.ts', 'steps/**/*.ts', 'lib/**/*.ts'],
  format: ['@cucumber/pretty-formatter'],
  parallel: 3,
}

if (platform() === 'win32') {
  result.tags = 'not @skip_windows'
}

if (featureToRun) {
  result.paths = [featureToRun]
} else {
  result.paths = ['features/**/*.feature']
}

export default result
