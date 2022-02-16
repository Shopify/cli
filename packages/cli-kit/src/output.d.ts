declare enum ContentTokenType {
  Command = 0,
  Path = 1,
  Link = 2,
}
interface ContentMetadata {
  link?: string;
}
declare class ContentToken {
  type: ContentTokenType;
  value: string;
  metadata: ContentMetadata;
  constructor(
    value: string,
    metadata: ContentMetadata | undefined,
    type: ContentTokenType,
  );
}
export declare const token: {
  command: (value: string) => ContentToken;
  path: (value: string) => ContentToken;
  link: (value: string, link: string) => ContentToken;
};
declare class TokenizedString {
  value: string;
  constructor(value: string);
}
declare type Message = string | TokenizedString;
export declare function content(
  strings: TemplateStringsArray,
  ...keys: (ContentToken | string)[]
): TokenizedString;
export declare const success: (content: Message) => void;
export declare const message: (content: Message) => void;
export declare const error: (content: Message) => void;
export {};
