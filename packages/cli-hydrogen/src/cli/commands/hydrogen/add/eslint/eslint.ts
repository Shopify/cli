import Command from '../../../../core/Command'

export async function addEslint(this: Command) {
  const {fs} = this

  await fs.write(
    '.eslintrc.js',
    (await import('./templates/eslintrc-js')).default(),
  )
  this.package.install('eslint', {dev: true, version: '^7.31.0'})
  this.package.install('eslint-plugin-hydrogen', {
    dev: true,
    version: '^0.6.2',
  })
}
