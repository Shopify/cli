import {AppLog} from './fetch_app_logs.js'
// import {writeFile} from '@shopify/cli-kit/node/fs'

const LOGS_PATH = '/runs'

export const writeAppLogsToFile = ({appLog, writePath}: {appLog: AppLog; writePath: string}) => {
  console.log('writing log to file')
  console.log('appLog', appLog)
  console.log('writePath', writePath)

  const string = `hello world`

  // await writeFile(writePath, string)
}
