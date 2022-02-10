import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {file, path} from '@shopify/cli-kit';

import {configurationFileNames, genericConfigurationFileNames} from '../constants';

import {load} from './app';

describe('load', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await file.mkTmpDir();
  });

  afterEach(async () => {
    if (tmpDir) {
      await file.rmdir(tmpDir);
    }
  });

  let writeConfig = async (appConfiguration) => {
    const appConfigurationPath = path.join(tmpDir, configurationFileNames.app);
    await file.write(appConfigurationPath, appConfiguration);
  }

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
    await expect(load(tmpDir)).rejects.toThrow(/Invalid schema/);
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
        const yarnLockPath = path.join(tmpDir, genericConfigurationFileNames.yarn.lockfile);
        await file.write(yarnLockPath, '');

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.packageManager).toBe('yarn');
      });
    });

    describe('with extensions', async () => {
      it("throws an error if the configuration file doesn't exist", async () => {
        // Given

        const uiExtensionConfigurationPath = path.join(
          tmpDir,
          'ui-extensions',
          'my-extension',
          configurationFileNames.uiExtension,
        );
        await file.mkdir(path.dirname(uiExtensionConfigurationPath));

        // When
        await expect(load(tmpDir)).rejects.toThrow(
          /Couldn't find the configuration file/,
        );
      });

      it('throws an error if the configuration file is invalid', async () => {
        // Given
        const uiExtensionConfiguration = `
        wrong = "my_extension"
          `;
        const uiExtensionConfigurationPath = path.join(
          tmpDir,
          'ui-extensions',
          'my-extension',
          configurationFileNames.uiExtension,
        );
        await file.mkdir(path.dirname(uiExtensionConfigurationPath));
        await file.write(uiExtensionConfigurationPath, uiExtensionConfiguration);

        // When
        await expect(load(tmpDir)).rejects.toThrow(/Invalid schema/);
      });

      it('loads the app when it has an extension', async () => {
        // Given
        const uiExtensionConfiguration = `
        name = "my_extension"
          `;
        const uiExtensionConfigurationPath = path.join(
          tmpDir,
          'ui-extensions',
          'my-extension',
          configurationFileNames.uiExtension,
        );
        await file.mkdir(path.dirname(uiExtensionConfigurationPath));
        await file.write(uiExtensionConfigurationPath, uiExtensionConfiguration);

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.uiExtensions[0].configuration.name).toBe('my_extension');
      });

      it('loads the app with several extensions', async () => {
        // Given
        let uiExtensionConfiguration = `
        name = "my_extension_1"
          `;
        let uiExtensionConfigurationPath = path.join(
          tmpDir,
          'ui-extensions',
          'my-extension-1',
          configurationFileNames.uiExtension,
        );
        await file.mkdir(path.dirname(uiExtensionConfigurationPath));
        await file.write(uiExtensionConfigurationPath, uiExtensionConfiguration);

        uiExtensionConfiguration = `
        name = "my_extension_2"
          `;
        uiExtensionConfigurationPath = path.join(
          tmpDir,
          'ui-extensions',
          'my-extension-2',
          configurationFileNames.uiExtension,
        );
        await file.mkdir(path.dirname(uiExtensionConfigurationPath));
        await file.write(uiExtensionConfigurationPath, uiExtensionConfiguration);

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
        const scriptConfigurationPath = path.join(
          tmpDir,
          'scripts',
          'my-script',
          configurationFileNames.script,
        );
        await file.mkdir(path.dirname(scriptConfigurationPath));

        // When
        await expect(load(tmpDir)).rejects.toThrow(
          /Couldn't find the configuration file/,
        );
      });

      it('throws an error if the configuration file is invalid', async () => {
        // Given
        const scriptConfiguration = `
          wrong = "my_script_2"
        `;
        const scriptConfigurationPath = path.join(
          tmpDir,
          'scripts',
          'my-script',
          configurationFileNames.script,
        );
        await file.mkdir(path.dirname(scriptConfigurationPath));
        await file.write(scriptConfigurationPath, scriptConfiguration);

        // When
        await expect(load(tmpDir)).rejects.toThrow(/Invalid schema/);
      });

      it('loads the app when it has an script', async () => {
        // Given
        const scriptConfiguration = `
        name = "my_script"
          `;
        const scriptConfigurationPath = path.join(
          tmpDir,
          'scripts',
          'my-script',
          configurationFileNames.script,
        );
        await file.mkdir(path.dirname(scriptConfigurationPath));
        await file.write(scriptConfigurationPath, scriptConfiguration);

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.scripts[0].configuration.name).toBe('my_script');
      });

      it('loads the app with several scripts', async () => {
        // Given
        let scriptConfiguration = `
        name = "my_script_1"
          `;
        let scriptConfigurationPath = path.join(
          tmpDir,
          'scripts',
          'my-script-1',
          configurationFileNames.script,
        );
        await file.mkdir(path.dirname(scriptConfigurationPath));
        await file.write(scriptConfigurationPath, scriptConfiguration);

        scriptConfiguration = `
        name = "my_script_2"
          `;
        scriptConfigurationPath = path.join(
          tmpDir,
          'scripts',
          'my-script-2',
          configurationFileNames.script,
        );
        await file.mkdir(path.dirname(scriptConfigurationPath));
        await file.write(scriptConfigurationPath, scriptConfiguration);

        // When
        const app = await load(tmpDir);

        // Then
        expect(app.scripts).toHaveLength(2);
        expect(app.scripts[0].configuration.name).toBe('my_script_1');
        expect(app.scripts[1].configuration.name).toBe('my_script_2');
      });
    });
  });
});
