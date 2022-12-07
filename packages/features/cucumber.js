const {platform} = require('os')

const isCI = process.env.NODE_ENV === 'ci'
const featureToRun = process.env.FEATURE

const common = [
  '--publish-quiet',
  '--require-module ts-node/register',
  '--require world/**/*.ts',
  '--require steps/**/*.ts',
  '--require lib/**/*.ts',
  '--format @cucumber/pretty-formatter',
  '--parallel 3',
]

if (platform() === 'win32') {
  common.push(`--tags "not @skip_windows"`)
}

if (featureToRun) {
  common.push(featureToRun)
} else {
  common.push('features/**/*.feature')
}

module.exports = {
  default: common.join(' '),
}
