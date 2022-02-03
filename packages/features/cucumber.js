const isCI = process.env.NODE_ENV === 'ci';
const featureToRun = process.env.FEATURE;

const common = [
  '--require-module ts-node/register',
  '--require world/**/*.ts',
  '--require steps/**/*.ts',
  '--require lib/**/*.ts',
  '--format-options \'{"colorsEnabled": true}\'',
  '--format progress',
  '--format node_modules/cucumber-pretty',
];
if (isCI) {
  common.push(
    '--format node_modules/cucumber-junit-formatter:/tmp/artifacts/acceptance.junit',
  );
}
if (featureToRun) {
  common.push(featureToRun);
} else {
  common.push('features/**/*.feature');
}

module.exports = {
  default: common.join(' '),
};
