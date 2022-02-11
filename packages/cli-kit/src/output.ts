import pc from 'picocolors';
import terminalLink from 'terminal-link';

enum ContentTokenType {
  Command,
  Path,
  Link,
}

interface ContentMetadata {
  link?: string;
}

class ContentToken {
  type: ContentTokenType;
  value: string;
  metadata: ContentMetadata;

  constructor(
    value: string,
    metadata: ContentMetadata = {},
    type: ContentTokenType,
  ) {
    this.type = type;
    this.value = value;
    this.metadata = metadata;
  }
}

export const token = {
  command: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.Command);
  },
  path: (value: string) => {
    return new ContentToken(value, {}, ContentTokenType.Path);
  },
  link: (value: string, link: string) => {
    return new ContentToken(value, {link}, ContentTokenType.Link);
  },
};

// output.content`Something ${output.token.command(Something)}`

class Message {
  value: string;
  constructor(value: string) {
    this.value = value;
  }
}

export function content(
  strings: TemplateStringsArray,
  ...keys: (ContentToken | string)[]
): Message {
  let output = ``;
  strings.forEach((string, i) => {
    output += string;
    if (i >= keys.length) {
      return;
    }
    const token = keys[i];
    if (typeof token === 'string') {
      output += token;
    } else {
      const enumToken = token as ContentToken;
      switch (enumToken.type) {
        case ContentTokenType.Command:
          output += pc.bold(pc.yellow(enumToken.value));
          break;
        case ContentTokenType.Path:
          output += pc.italic(enumToken.value);
          break;
        case ContentTokenType.Link:
          output += terminalLink(
            enumToken.value,
            enumToken.metadata.link ?? '',
          );
          break;
      }
    }
  });
  return new Message(output);
}

export const success = (content: Message) => {
  console.log(pc.green(`🎉 ${content.value}`));
};

export const message = (content: Message) => {
  console.log(content.value);
};
