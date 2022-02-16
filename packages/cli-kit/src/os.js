import process from 'node:process';
import os from 'node:os';
import {execa} from 'execa';
const getEnvironmentVariable = () => {
  const {env} = process;
  return (
    env.SUDO_USER ||
    env.C9_USER ||
    env.LOGNAME ||
    env.USER ||
    env.LNAME ||
    env.USERNAME
  );
};
const getUsernameFromOsUserInfo = () => {
  try {
    return os.userInfo().username;
  } catch {
    return null;
  }
};
const cleanWindowsCommand = (value) => value.replace(/^.*\\/, '');
const makeUsernameFromId = (userId) => `no-username-${userId}`;
// This code has been vendored from https://github.com/sindresorhus/username
// because adding it as a transtive dependency causes conflicts with other
// packages that haven't been yet migrated to the latest version.
export const username = async () => {
  const environmentVariable = getEnvironmentVariable();
  if (environmentVariable) {
    return environmentVariable;
  }
  const userInfoUsername = getUsernameFromOsUserInfo();
  if (userInfoUsername) {
    return userInfoUsername;
  }
  /**
      First we try to get the ID of the user and then the actual username. We do this because in `docker run --user <uid>:<gid>` context, we don't have "username" available. Therefore, we have a fallback to `makeUsernameFromId` for such scenario. Applies also to the `sync()` method below.
      */
  try {
    if (process.platform === 'win32') {
      const {stdout} = await execa('whoami');
      return cleanWindowsCommand(stdout);
    }
    const {stdout: userId} = await execa('id', ['-u']);
    try {
      const {stdout} = await execa('id', ['-un', userId]);
      return stdout;
      // eslint-disable-next-line no-empty
    } catch {}
    return makeUsernameFromId(userId);
  } catch {
    return null;
  }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLE9BQU8sTUFBTSxjQUFjLENBQUM7QUFDbkMsT0FBTyxFQUFFLE1BQU0sU0FBUyxDQUFDO0FBRXpCLE9BQU8sRUFBQyxLQUFLLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFFNUIsTUFBTSxzQkFBc0IsR0FBRyxHQUFHLEVBQUU7SUFDbEMsTUFBTSxFQUFDLEdBQUcsRUFBQyxHQUFHLE9BQU8sQ0FBQztJQUV0QixPQUFPLENBQ0wsR0FBRyxDQUFDLFNBQVM7UUFDYixHQUFHLENBQUMsT0FBTztRQUNYLEdBQUcsQ0FBQyxPQUFPO1FBQ1gsR0FBRyxDQUFDLElBQUk7UUFDUixHQUFHLENBQUMsS0FBSztRQUNULEdBQUcsQ0FBQyxRQUFRLENBQ2IsQ0FBQztBQUNKLENBQUMsQ0FBQztBQUVGLE1BQU0seUJBQXlCLEdBQUcsR0FBa0IsRUFBRTtJQUNwRCxJQUFJO1FBQ0YsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO0tBQy9CO0lBQUMsTUFBTTtRQUNOLE9BQU8sSUFBSSxDQUFDO0tBQ2I7QUFDSCxDQUFDLENBQUM7QUFFRixNQUFNLG1CQUFtQixHQUFHLENBQUMsS0FBYSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztBQUUxRSxNQUFNLGtCQUFrQixHQUFHLENBQUMsTUFBYyxFQUFFLEVBQUUsQ0FBQyxlQUFlLE1BQU0sRUFBRSxDQUFDO0FBRXZFLDRFQUE0RTtBQUM1RSwwRUFBMEU7QUFDMUUsaUVBQWlFO0FBQ2pFLE1BQU0sQ0FBQyxNQUFNLFFBQVEsR0FBRyxLQUFLLElBQTRCLEVBQUU7SUFDekQsTUFBTSxtQkFBbUIsR0FBRyxzQkFBc0IsRUFBRSxDQUFDO0lBQ3JELElBQUksbUJBQW1CLEVBQUU7UUFDdkIsT0FBTyxtQkFBbUIsQ0FBQztLQUM1QjtJQUVELE1BQU0sZ0JBQWdCLEdBQUcseUJBQXlCLEVBQUUsQ0FBQztJQUNyRCxJQUFJLGdCQUFnQixFQUFFO1FBQ3BCLE9BQU8sZ0JBQWdCLENBQUM7S0FDekI7SUFFRDs7UUFFQztJQUNELElBQUk7UUFDRixJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxFQUFFO1lBQ2hDLE1BQU0sRUFBQyxNQUFNLEVBQUMsR0FBRyxNQUFNLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN2QyxPQUFPLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ3BDO1FBRUQsTUFBTSxFQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUMsR0FBRyxNQUFNLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ25ELElBQUk7WUFDRixNQUFNLEVBQUMsTUFBTSxFQUFDLEdBQUcsTUFBTSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDcEQsT0FBTyxNQUFNLENBQUM7WUFDZCxvQ0FBb0M7U0FDckM7UUFBQyxNQUFNLEdBQUU7UUFDVixPQUFPLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ25DO0lBQUMsTUFBTTtRQUNOLE9BQU8sSUFBSSxDQUFDO0tBQ2I7QUFDSCxDQUFDLENBQUMifQ==
