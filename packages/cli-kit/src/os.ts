import process from 'node:process'
import os from 'node:os'
import {execa} from 'execa'

const getEnvironmentVariable = () => {
  const {env} = process

  return env.SUDO_USER || env.C9_USER || env.LOGNAME || env.USER || env.LNAME || env.USERNAME
}

const getUsernameFromOsUserInfo = (): string | null => {
  try {
    return os.userInfo().username
  } catch {
    return null
  }
}

const cleanWindowsCommand = (value: string) => value.replace(/^.*\\/, '')

const makeUsernameFromId = (userId: string) => `no-username-${userId}`

// This code has been vendored from https://github.com/sindresorhus/username
// because adding it as a transtive dependency causes conflicts with other
// packages that haven't been yet migrated to the latest version.
export const username = async (): Promise<string | null> => {
  const environmentVariable = getEnvironmentVariable()
  if (environmentVariable) {
    return environmentVariable
  }

  const userInfoUsername = getUsernameFromOsUserInfo()
  if (userInfoUsername) {
    return userInfoUsername
  }

  /**
	First we try to get the ID of the user and then the actual username. We do this because in `docker run --user <uid>:<gid>` context, we don't have "username" available. Therefore, we have a fallback to `makeUsernameFromId` for such scenario. Applies also to the `sync()` method below.
	*/
  try {
    if (process.platform === 'win32') {
      const {stdout} = await execa('whoami')
      return cleanWindowsCommand(stdout)
    }

    const {stdout: userId} = await execa('id', ['-u'])
    try {
      const {stdout} = await execa('id', ['-un', userId])
      return stdout
      // eslint-disable-next-line no-empty
    } catch {}
    return makeUsernameFromId(userId)
  } catch {
    return null
  }
}
