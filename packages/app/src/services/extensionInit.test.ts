// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {file, path} from '@shopify/cli-kit';

import {App, load as loadApp} from '../cli/app/app';
import extensionInit from './extensionInit';
import {configurationFileNames, ExtensionTypes} from '../cli/constants';

class MockLog {
  contents: string;

  constructor() {
    this.contents = "";
  }

  log(message: string) {
    this.contents += `${message}\n`;
  }

  clear() {
    this.contents = "";
  }

  toFunc() {
    return this.log.bind(this);
  }
}

describe('initialize an extension', async () => {
  let tmpDir: string;
  let log: MockLog;

  beforeEach(async () => {
    tmpDir = await file.mkTmpDir();
    const appConfigurationPath = path.join(tmpDir, configurationFileNames.app);
    const appConfiguration = `
      name = "my_app"
      `;
    await file.write(appConfigurationPath, appConfiguration);
    log = new MockLog();
  });
  afterEach(async () => {
    if (tmpDir) {
      await file.rmdir(tmpDir);
    }
  });

  interface CreateFromTemplateOptions {
    name: string;
    extensionType: ExtensionTypes;
  }
  const createFromTemplate = async ({name, extensionType}: CreateFromTemplateOptions) => {
    await extensionInit({
      name,
      extensionType,
      parentApp: await loadApp(tmpDir),
      log: log.toFunc(),
    });
  }

  it('successfully scaffolds the extension when no other extensions exist', async () => {
    const name = "my-ext-1";
    const extensionType = "checkout-post-purchase";
    await createFromTemplate({name, extensionType});
    expect(log.contents).toContain("Generating .shopify.ui-extension.toml");
    expect(log.contents).toContain("Generating index.jsx");
    const scaffoldedExtension = (await loadApp(tmpDir)).uiExtensions[0];
    expect(scaffoldedExtension.configuration.name).toBe(name);
  });

  it('successfully scaffolds the extension when another extension exists', async () => {
    const name1 = "my-ext-1";
    const name2 = "my-ext-2";
    const extensionType = "checkout-post-purchase";
    await createFromTemplate({name: name1, extensionType});
    await createFromTemplate({name: name2, extensionType});
    const scaffoldedExtension2 = (await loadApp(tmpDir)).uiExtensions[1];
    expect(scaffoldedExtension2.configuration.name).toBe(name2);
  });

  it('errors when trying to re-scaffold an existing extension', async () => {
    const name = "my-ext-1";
    const extensionType = "checkout-post-purchase";
    await createFromTemplate({name, extensionType});
    await expect(createFromTemplate({name, extensionType})).rejects.toThrow(`Extension ${name} already exists!`);
  });
});
