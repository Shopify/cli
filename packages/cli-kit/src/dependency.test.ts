import {describe, it, expect, vi} from 'vitest';


import {Bug} from './error';
import {
  dependencyManagerUsedForCreating,
  DependencyManager,
  install,
} from './dependency';
import {exec} from './system';


vi.mock("./system")
const mockedExec = vi.mocked(exec)

describe('dependencyManagerUsedForCreating', () => {
  it('returns npm if the lifecycle event says npx', () => {
    // Given
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const env = {npm_lifecycle_event: 'npx'};

    // When
    const got = dependencyManagerUsedForCreating(env);

    // Then
    expect(got).toBe(DependencyManager.Npm);
  });

  it('returns pnpm if the npm_config_user_agent variable contains yarn', () => {
    // Given
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const env = {npm_config_user_agent: 'yarn/1.22.17'};

    // When
    const got = dependencyManagerUsedForCreating(env);

    // Then
    expect(got).toBe(DependencyManager.Yarn);
  });

  it('returns pnpm if it contains the PNPM_HOME variable', () => {
    // Given
    const env = {PNPM_HOME: '/path/to/pnpm'};

    // When
    const got = dependencyManagerUsedForCreating(env);

    // Then
    expect(got).toBe(DependencyManager.Pnpm);
  });

  it('throws an bug error when the package manager cannot be determined', () => {
    expect(() => {
      dependencyManagerUsedForCreating({});
    }).toThrow(
      new Bug(
        "Couldn't determine the dependency used to run the create workflow",
      ),
    );
  });
});

describe("install", () => {
  it("runs the install command", async () => {
    // Given
    const dependencyManager = DependencyManager.Npm
    const directory = "/path/to/project"

    // When
    await install(directory, dependencyManager);

    // Then
    expect(mockedExec).toHaveBeenCalledWith(dependencyManager, ["install"], {cwd: directory})
  })
})
