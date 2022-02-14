import {Loggable} from '../types';

interface ErrorOptions {
  title?: string;
  content?: Loggable;
  suggestion?: Loggable;
}

const ID = Symbol.for('HydrogenCLI::HelpfulError');

export function isHelpfulError(value: unknown) {
  return Boolean((value as any)?.[ID]);
}

export class HelpfulError extends Error {
  readonly [ID] = true;
  readonly suggestion: ErrorOptions['suggestion'];
  readonly title: ErrorOptions['title'];
  readonly content: ErrorOptions['content'];

  constructor({title, content, suggestion}: ErrorOptions) {
    super(title);
    this.title = title;
    this.content = content;
    this.suggestion = suggestion;
  }
}

export class MissingDependencyError extends HelpfulError {
  constructor(dep: string) {
    super({
      title: `Missing the \`${dep}\` dependency`,
      content: `\`${dep}\` is required to use this command.`,
      suggestion: [
        `- Run \`yarn\` to install all dependencies listed in the package.json.`,
        `- Run \`yarn add ${dep}\` to install the missing dependency.`,
      ].join(`\n`),
    });
  }
}

export function logError(
  error: Error & ErrorOptions,
  log: (message: string, options?: any) => void,
) {
  log(error.title ?? error.message ?? 'An unexpected error occurred', {
    error: true,
    breakAfter: true,
  });

  if (isHelpfulError(error)) {
    if (error.content) {
      log('What happened?', {strong: true});
      log(typeof error.content === 'string' ? error.content : error.content(), {
        breakAfter: true,
      });
    }

    if (error.suggestion) {
      log('What do I do next?', {strong: true});
      log(
        typeof error.suggestion === 'string'
          ? error.suggestion
          : error.suggestion(),
        {breakAfter: true},
      );
    }

    log('Still experiencing issues?', {strong: true});
  }
  log(
    'Help us make Hydrogen better by reporting this error so we can improve this message and/or fix the error.',
  );
  log('- Chat with us on Discord: https://discord.com/invite/ppSbThrFaS');
  log(
    '- Create an issue in GitHub: https://github.com/Shopify/hydrogen/issues/new',
    {breakAfter: true},
  );

  log('Error stack:', {strong: true});
  if (error.stack) {
    log(error.stack, {breakAfter: true});
  }
}
