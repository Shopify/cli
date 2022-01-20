import {Interfaces, HelpBase} from '@oclif/core';

export default class CustomHelp extends HelpBase {
  async showHelp(argv: string[]) {
    console.log(`This will be displayed in multi-command CLIs: ${argv}`);
  }

  async showCommandHelp(
    command: Interfaces.Command,
    topics: Interfaces.Topic[],
  ) {
    console.log(
      `This will be displayed in single-command CLIs: ${command} ${topics}`,
    );
  }
}
