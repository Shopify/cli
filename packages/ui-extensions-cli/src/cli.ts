import {build} from './build'

run()
  .then(() => {})
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(1)
  })

async function run() {
  const command = process.argv.slice(2)[0]
  switch (command) {
    case 'build': {
      await build({mode: 'production'})
      break
    }
    case 'develop': {
      await build({mode: 'development'})
      break
    }
  }
}
