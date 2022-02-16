import {Bug} from './error';
import {exec} from './system';
export var DependencyManager;
(function (DependencyManager) {
  DependencyManager['Npm'] = 'npm';
  DependencyManager['Yarn'] = 'yarn';
  DependencyManager['Pnpm'] = 'pnpm';
})(DependencyManager || (DependencyManager = {}));
/**
 * Returns the dependency manager used to run the create workflow.
 * @param env {Object} The environment variables of the process in which the CLI runs.
 * @returns The dependency manager
 */
export function dependencyManagerUsedForCreating(env = process.env) {
  if (env.npm_lifecycle_event === 'npx') {
    return DependencyManager.Npm;
  } else if (env.npm_config_user_agent?.includes('yarn')) {
    return DependencyManager.Yarn;
  } else if (env.PNPM_HOME) {
    return DependencyManager.Pnpm;
  } else {
    throw new Bug(
      "Couldn't determine the dependency used to run the create workflow",
    );
  }
}
/**
 * Installs the dependencies in the given directory.
 * @param directory {string} The directory that contains the package.json
 * @param dependencyManager {DependencyManager} The dependency manager to use to install the dependencies.
 * @returns
 */
export async function install(directory, dependencyManager) {
  await exec(dependencyManager, ['install'], {
    cwd: directory,
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwZW5kZW5jeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlcGVuZGVuY3kudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUM1QixPQUFPLEVBQUMsSUFBSSxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBRTlCLE1BQU0sQ0FBTixJQUFZLGlCQUlYO0FBSkQsV0FBWSxpQkFBaUI7SUFDM0IsZ0NBQVcsQ0FBQTtJQUNYLGtDQUFhLENBQUE7SUFDYixrQ0FBYSxDQUFBO0FBQ2YsQ0FBQyxFQUpXLGlCQUFpQixLQUFqQixpQkFBaUIsUUFJNUI7QUFFRDs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLGdDQUFnQyxDQUM5QyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUc7SUFFakIsSUFBSSxHQUFHLENBQUMsbUJBQW1CLEtBQUssS0FBSyxFQUFFO1FBQ3JDLE9BQU8saUJBQWlCLENBQUMsR0FBRyxDQUFDO0tBQzlCO1NBQU0sSUFBSSxHQUFHLENBQUMscUJBQXFCLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3RELE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDO0tBQy9CO1NBQU0sSUFBSSxHQUFHLENBQUMsU0FBUyxFQUFFO1FBQ3hCLE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDO0tBQy9CO1NBQU07UUFDTCxNQUFNLElBQUksR0FBRyxDQUNYLG1FQUFtRSxDQUNwRSxDQUFDO0tBQ0g7QUFDSCxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLE9BQU8sQ0FDM0IsU0FBaUIsRUFDakIsaUJBQW9DO0lBRXBDLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDekMsR0FBRyxFQUFFLFNBQVM7S0FDZixDQUFDLENBQUM7QUFDTCxDQUFDIn0=
