import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {file, path} from '@shopify/cli-kit';

import {configurationFileNames} from '../constants';

import {load} from './app';

describe('load', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = file.mkTmpDir();
  });

  afterEach(() => {
    if (tmpDir) {
      file.rmdir(tmpDir);
    }
  });

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

  it('loads the app when its configuration is valid and has no blocks', async () => {
    // Given
    const appConfiguration = `
        name = "my_app"
        `;
    const appConfigurationPath = path.join(tmpDir, configurationFileNames.app);
    file.write(appConfigurationPath, appConfiguration);

    // When
    const app = await load(tmpDir);

    // Then
    expect(app.configuration.name).toBe('my_app');
  });

  describe('with extensions', () => {
    it("throws an error if the configuration file doesn't exist", async () => {
      // Given
      const appConfiguration = `
          name = "my_app"
          `;
      const appConfigurationPath = path.join(
        tmpDir,
        configurationFileNames.app,
      );
      file.write(appConfigurationPath, appConfiguration);

      const uiExtensionConfigurationPath = path.join(
        tmpDir,
        'ui-extensions',
        'my-extension',
        '.shopify.ui-extension.toml',
      );
      file.mkdir(path.dirname(uiExtensionConfigurationPath));

      // When
      await expect(load(tmpDir)).rejects.toThrow(
        /Couldn't find the configuration file/,
      );
    });

    it('loads the app when it has an extension', async () => {
      // Given
      const appConfiguration = `
          name = "my_app"
          `;
      const appConfigurationPath = path.join(
        tmpDir,
        configurationFileNames.app,
      );
      file.write(appConfigurationPath, appConfiguration);

      const uiExtensionConfiguration = `
        name = "my_extension"
          `;
      const uiExtensionConfigurationPath = path.join(
        tmpDir,
        'ui-extensions',
        'my-extension',
        '.shopify.ui-extension.toml',
      );
      file.mkdir(path.dirname(uiExtensionConfigurationPath));
      file.write(uiExtensionConfigurationPath, uiExtensionConfiguration);

      // When
      const app = await load(tmpDir);

      // Then
      expect(app.uiExtensions[0].configuration.name).toBe('my_extension');
    });

    it('loads the app with several extensions', async () => {
      // Given
      const appConfiguration = `
          name = "my_app"
          `;
      const appConfigurationPath = path.join(
        tmpDir,
        configurationFileNames.app,
      );
      file.write(appConfigurationPath, appConfiguration);

      let uiExtensionConfiguration = `
        name = "my_extension_1"
          `;
      let uiExtensionConfigurationPath = path.join(
        tmpDir,
        'ui-extensions',
        'my-extension-1',
        '.shopify.ui-extension.toml',
      );
      file.mkdir(path.dirname(uiExtensionConfigurationPath));
      file.write(uiExtensionConfigurationPath, uiExtensionConfiguration);

      uiExtensionConfiguration = `
        name = "my_extension_2"
          `;
      uiExtensionConfigurationPath = path.join(
        tmpDir,
        'ui-extensions',
        'my-extension-2',
        '.shopify.ui-extension.toml',
      );
      file.mkdir(path.dirname(uiExtensionConfigurationPath));
      file.write(uiExtensionConfigurationPath, uiExtensionConfiguration);

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
      const appConfiguration = `
          name = "my_app"
          `;
      const appConfigurationPath = path.join(
        tmpDir,
        configurationFileNames.app,
      );
      file.write(appConfigurationPath, appConfiguration);

      const scriptConfigurationPath = path.join(
        tmpDir,
        'scripts',
        'my-script',
        '.shopify.script.toml',
      );
      file.mkdir(path.dirname(scriptConfigurationPath));

      // When
      await expect(load(tmpDir)).rejects.toThrow(
        /Couldn't find the configuration file/,
      );
    });

    it('loads the app when it has an script', async () => {
      // Given
      const appConfiguration = `
          name = "my_app"
          `;
      const appConfigurationPath = path.join(
        tmpDir,
        configurationFileNames.app,
      );
      file.write(appConfigurationPath, appConfiguration);

      const scriptConfiguration = `
        name = "my_script"
          `;
      const scriptConfigurationPath = path.join(
        tmpDir,
        'scripts',
        'my-script',
        '.shopify.script.toml',
      );
      file.mkdir(path.dirname(scriptConfigurationPath));
      file.write(scriptConfigurationPath, scriptConfiguration);

      // When
      const app = await load(tmpDir);

      // Then
      expect(app.scripts[0].configuration.name).toBe('my_script');
    });

    it('loads the app with several scripts', async () => {
      // Given
      const appConfiguration = `
          name = "my_app"
          `;
      const appConfigurationPath = path.join(
        tmpDir,
        configurationFileNames.app,
      );
      file.write(appConfigurationPath, appConfiguration);

      let scriptConfiguration = `
        name = "my_script_1"
          `;
      let scriptConfigurationPath = path.join(
        tmpDir,
        'scripts',
        'my-script-1',
        '.shopify.script.toml',
      );
      file.mkdir(path.dirname(scriptConfigurationPath));
      file.write(scriptConfigurationPath, scriptConfiguration);

      scriptConfiguration = `
        name = "my_script_2"
          `;
      scriptConfigurationPath = path.join(
        tmpDir,
        'scripts',
        'my-script-2',
        '.shopify.script.toml',
      );
      file.mkdir(path.dirname(scriptConfigurationPath));
      file.write(scriptConfigurationPath, scriptConfiguration);

      // When
      const app = await load(tmpDir);

      // Then
      expect(app.scripts).toHaveLength(2);
      expect(app.scripts[0].configuration.name).toBe('my_script_1');
      expect(app.scripts[1].configuration.name).toBe('my_script_2');
    });
  });
});
