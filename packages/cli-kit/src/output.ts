import {string} from 'index';
import pc from 'picocolors';

enum ContentTokenType {
  Command,
  Path,
}

class ContentToken {
  type: ContentTokenType;
  value: string;

  constructor(value: string, type: ContentTokenType) {
    this.type = type;
    this.value = value;
  }
}

export const token = {
  command: (value: string) => {
    return new ContentToken(value, ContentTokenType.Command);
  },
  path: (value: string) => {
    return new ContentToken(value, ContentTokenType.Path);
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
  ...keys: ContentToken[]
): Message {
  let output = ``;
  strings.forEach((string, i) => {
    output += string;
    if (i >= keys.length) {
      return;
    }
    const token = keys[i];
    switch (token.type) {
      case ContentTokenType.Command:
        output += pc.bold(token.value);
        break;
      case ContentTokenType.Path:
        output += pc.italic(token.value);
        break;
    }
  });
  return new Message(output);
}

export const success = (content: Message) => {
  console.log(pc.green(`🎉 ${content.value}`));
};
