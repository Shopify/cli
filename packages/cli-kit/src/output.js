import pc from 'picocolors';
import terminalLink from 'terminal-link';
var ContentTokenType;
(function (ContentTokenType) {
  ContentTokenType[(ContentTokenType['Command'] = 0)] = 'Command';
  ContentTokenType[(ContentTokenType['Path'] = 1)] = 'Path';
  ContentTokenType[(ContentTokenType['Link'] = 2)] = 'Link';
})(ContentTokenType || (ContentTokenType = {}));
class ContentToken {
  constructor(value, metadata = {}, type) {
    this.type = type;
    this.value = value;
    this.metadata = metadata;
  }
}
export const token = {
  command: (value) => {
    return new ContentToken(value, {}, ContentTokenType.Command);
  },
  path: (value) => {
    return new ContentToken(value, {}, ContentTokenType.Path);
  },
  link: (value, link) => {
    return new ContentToken(value, {link}, ContentTokenType.Link);
  },
};
// output.content`Something ${output.token.command(Something)}`
class TokenizedString {
  constructor(value) {
    this.value = value;
  }
}
export function content(strings, ...keys) {
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
      const enumToken = token;
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
  return new TokenizedString(output);
}
export const success = (content) => {
  // eslint-disable-next-line no-console
  console.log(pc.green(`🎉 ${stringifyMessage(content)}`));
};
export const message = (content) => {
  // eslint-disable-next-line no-console
  console.log(stringifyMessage(content));
};
export const error = (content) => {
  // eslint-disable-next-line no-console
  console.error(stringifyMessage(content));
};
function stringifyMessage(message) {
  if (message instanceof TokenizedString) {
    return message.value;
  } else {
    return message;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsib3V0cHV0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM1QixPQUFPLFlBQVksTUFBTSxlQUFlLENBQUM7QUFFekMsSUFBSyxnQkFJSjtBQUpELFdBQUssZ0JBQWdCO0lBQ25CLDZEQUFPLENBQUE7SUFDUCx1REFBSSxDQUFBO0lBQ0osdURBQUksQ0FBQTtBQUNOLENBQUMsRUFKSSxnQkFBZ0IsS0FBaEIsZ0JBQWdCLFFBSXBCO0FBTUQsTUFBTSxZQUFZO0lBS2hCLFlBQ0UsS0FBYSxFQUNiLFdBQTRCLEVBQUUsRUFDOUIsSUFBc0I7UUFFdEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDM0IsQ0FBQztDQUNGO0FBRUQsTUFBTSxDQUFDLE1BQU0sS0FBSyxHQUFHO0lBQ25CLE9BQU8sRUFBRSxDQUFDLEtBQWEsRUFBRSxFQUFFO1FBQ3pCLE9BQU8sSUFBSSxZQUFZLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBQ0QsSUFBSSxFQUFFLENBQUMsS0FBYSxFQUFFLEVBQUU7UUFDdEIsT0FBTyxJQUFJLFlBQVksQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFDRCxJQUFJLEVBQUUsQ0FBQyxLQUFhLEVBQUUsSUFBWSxFQUFFLEVBQUU7UUFDcEMsT0FBTyxJQUFJLFlBQVksQ0FBQyxLQUFLLEVBQUUsRUFBQyxJQUFJLEVBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoRSxDQUFDO0NBQ0YsQ0FBQztBQUVGLCtEQUErRDtBQUUvRCxN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
