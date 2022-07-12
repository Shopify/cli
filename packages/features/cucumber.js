const isCI = process.env.NODE_ENV === 'ci'
const featureToRun = process.env.FEATURE
const nodeVersion = process.version.match(/^v(\d+\.\d+)/)[1]
const isNode14 = nodeVersion.startsWith('14')

const common = [
  '--publish-quiet',
  '--require-module ts-node/register',
  '--require world/**/*.ts',
  '--require steps/**/*.ts',
  '--require lib/**/*.ts',
  '--format @cucumber/pretty-formatter',
  '--parallel 3',
]

if (isNode14) {
  common.push(`--tags ~@skip_node_14`)
}

if (isCI) {
  common.push('--format node_modules/cucumber-junit-formatter:/tmp/artifacts/acceptance.junit')
}
if (featureToRun) {
  common.push(featureToRun)
} else {
  common.push('features/**/*.feature')
}

module.exports = {
  default: common.join(' '),
}
