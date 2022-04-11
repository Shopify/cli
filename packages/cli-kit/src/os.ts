import {execa} from 'execa'
import {platform as processPlatform} from 'node:process'
import {userInfo as osUserInfo, arch as osArch} from 'node:os'
import {homedir} from 'os'

const getEnvironmentVariable = () => {
  const {env} = process

  return env.SUDO_USER || env.C9_USER || env.LOGNAME || env.USER || env.LNAME || env.USERNAME
}

const getUsernameFromOsUserInfo = (): string | null => {
  try {
    return osUserInfo().username
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return null
  }
}

const cleanWindowsCommand = (value: string) => value.replace(/^.*\\/, '')

const makeUsernameFromId = (userId: string) => `no-username-${userId}`

// This code has been vendored from https://github.com/sindresorhus/username
// because adding it as a transtive dependency causes conflicts with other
// packages that haven't been yet migrated to the latest version.
export const username = async (platform: typeof processPlatform = processPlatform): Promise<string | null> => {
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
    if (platform === 'win32') {
      const {stdout} = await execa('whoami')
      return cleanWindowsCommand(stdout)
    }

    const {stdout: userId} = await execa('id', ['-u'])
    try {
      const {stdout} = await execa('id', ['-un', userId])
      return stdout

      // eslint-disable-next-line no-catch-all/no-catch-all,no-empty
    } catch {}
    return makeUsernameFromId(userId)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return null
  }
}

/**
 * Returns the platform and architecture.
 * @returns {{platform: string, arch: string}} Returns the current platform and architecture.
 */
export const platformAndArch = (
  platform: typeof processPlatform = processPlatform,
): {platform: string; arch: string} => {
  let arch = osArch()
  if (arch === 'x64') {
    arch = 'amd64'
  }
  return {platform, arch}
}

export const homeDir = (): string => {
  return homedir()
}
