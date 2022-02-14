import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {file, path} from '@shopify/cli-kit';

import {
  configurationFileNames,
  blocks,
  genericConfigurationFileNames,
} from '../constants';

import {load} from './app';

describe('load', () => {
  type BlockType = 'uiExtensions' | 'scripts'

  let tmpDir: string;
  // Zod-generated validation message
  const missingName = [
    {
      code: 'invalid_type',
      expected: 'string',
      received: 'undefined',
      path: ['name'],
      message: 'Required',
    },
  ];
  const missingNameMessage = JSON.stringify(missingName, null, 2);

  beforeEach(async () => {
    tmpDir = await file.mkTmpDir();
  });

  afterEach(async () => {
    if (tmpDir) {
      await file.rmdir(tmpDir);
    }
  });

  const writeConfig = async (appConfiguration: string) => {
    const appConfigurationPath = path.join(tmpDir, configurationFileNames.app);
    await file.write(appConfigurationPath, appConfiguration);
  };

  const blockConfigurationPath = ({blockType, name}: {blockType: BlockType, name: string}) => {
    const block = blocks[blockType];
    return path.join(
      tmpDir,
      block.directoryName,
      name,
      block.configurationName,
    );
  };

  const makeBlockDir = async ({blockType, name}: {blockType: BlockType, name: string}) => {
    await file.mkdir(path.dirname(blockConfigurationPath({blockType, name})));
  };

  const writeBlockConfig = async ({blockType, blockConfiguration, name}: {blockType: BlockType, blockConfiguration: string, name: string}) => {
    await makeBlockDir({blockType, name});
    await file.write(
      blockConfigurationPath({blockType, name}),
      blockConfiguration,
    );
  };

  it("throws an error if the directory doesn't exist", async () => {
    // Given
    const directory = '/tmp/doesnt/exist';

    // When/Then
    await expect(load(directory)).rejects.toThrow(/Couldn't find directory/);
  });

  it("throws an error if the configuration file doesn't exist", async () => {
    // When/Then
    await expect(load(tmpDir)).rejects.toThrow(
      /Couldn't find the configuration file/,
    );
  });

  it('throws an error when the configuration file is invalid', async () => {
    // Given
    const appConfiguration = `
        wrong = "my_app"
        `;
    writeConfig(appConfiguration);

    // When/Then
    await expect(load(tmpDir)).rejects.toThrow(missingNameMessage);
  });

  describe('given a valid configuration', () => {
    beforeEach(async () => {
      const appConfiguration = `
        name = "my_app"
        `;
      writeConfig(appConfiguration);
    });

    describe('and no blocks', () => {
      it('loads the app', async () => {
        // When
        const app = await load(tmpDir);

        // Then
        expect(app.configuration.name).toBe('my_app');
      });

      it('defaults to assuming npm as package manager', async () => {
        // When
        const app = await load(tmpDir);

        // Then
        expect(app.packageManager).toBe('npm');
      });

      it('knows yarn is package manager when yarn.lock is present', async () => {
        // Given
        const yarnLockPath = path.join(
          tmpDir,
          genericConfigurationFileNames.yarn.lockfile,
        );
        await file.write(yarnLockPath, '');

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.packageManager).toBe('yarn');
      });

      it('knows yarn is package manager when yarn.lock is present', async () => {
        // Given
        const pnpmLockPath = path.join(
          tmpDir,
          genericConfigurationFileNames.pnpm.lockfile,
        );
        await file.write(pnpmLockPath, '');

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.packageManager).toBe('pnpm');
      });
    });

    describe('with extensions', async () => {
      it("throws an error if the configuration file doesn't exist", async () => {
        // Given
        makeBlockDir({blockType: 'uiExtensions', name: 'my-extension'});

        // When
        await expect(load(tmpDir)).rejects.toThrow(
          /Couldn't find the configuration file/,
        );
      });

      it('throws an error if the configuration file is invalid', async () => {
        // Given
        const blockConfiguration = `
          wrong = "my_extension"
          `;
        writeBlockConfig({
          blockType: 'uiExtensions',
          blockConfiguration,
          name: 'my-extension',
        });

        // When
        await expect(load(tmpDir)).rejects.toThrow(missingNameMessage);
      });

      it('loads the app when it has an extension', async () => {
        // Given
        const blockConfiguration = `
          name = "my_extension"
          `;
        writeBlockConfig({
          blockType: 'uiExtensions',
          blockConfiguration,
          name: 'my-extension',
        });

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.uiExtensions[0].configuration.name).toBe('my_extension');
      });

      it('loads the app with several extensions', async () => {
        // Given
        let blockConfiguration = `
          name = "my_extension_1"
          `;
        writeBlockConfig({
          blockType: 'uiExtensions',
          blockConfiguration,
          name: 'my_extension_1',
        });

        blockConfiguration = `
          name = "my_extension_2"
          `;
        writeBlockConfig({
          blockType: 'uiExtensions',
          blockConfiguration,
          name: 'my_extension_2',
        });

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.uiExtensions).toHaveLength(2);
        expect(app.uiExtensions[0].configuration.name).toBe('my_extension_1');
        expect(app.uiExtensions[1].configuration.name).toBe('my_extension_2');
      });
    });

    describe('with scripts', () => {
      it("throws an error if the configuration file doesn't exist", async () => {
        // Given
        makeBlockDir({blockType: 'scripts', name: 'my-script'});

        // When
        await expect(load(tmpDir)).rejects.toThrow(
          /Couldn't find the configuration file/,
        );
      });

      it('throws an error if the configuration file is invalid', async () => {
        // Given
        const blockConfiguration = `
          wrong = "my-script"
        `;
        writeBlockConfig({
          blockType: 'scripts',
          blockConfiguration,
          name: 'my-script',
        });

        // When
        await expect(load(tmpDir)).rejects.toThrowError(missingNameMessage);
      });

      it('loads the app when it has an script', async () => {
        // Given
        const blockConfiguration = `
          name = "my-script"
          `;
        writeBlockConfig({
          blockType: 'scripts',
          blockConfiguration,
          name: 'my-script',
        });

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.scripts[0].configuration.name).toBe('my-script');
      });

      it('loads the app with several scripts', async () => {
        // Given
        let blockConfiguration = `
          name = "my-script-1"
          `;
        writeBlockConfig({
          blockType: 'scripts',
          blockConfiguration,
          name: 'my-script-1',
        });

        blockConfiguration = `
          name = "my-script-2"
          `;
        writeBlockConfig({
          blockType: 'scripts',
          blockConfiguration,
          name: 'my-script-2',
        });

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.scripts).toHaveLength(2);
        expect(app.scripts[0].configuration.name).toBe('my-script-1');
        expect(app.scripts[1].configuration.name).toBe('my-script-2');
      });
    });
  });
});
