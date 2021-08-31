// SHARED

interface ExtensionKey {
  identifier: string;
  apiKey: string;
}

const SEPARATOR = '::';

export function getLocalExtensionKey({identifier, apiKey}: ExtensionKey) {
  // Since Web does not have access to the registration uuid
  // We skip passing the registration uuid for the local extenions key
  // This means that there's a limit of 1 local extension of each type per app
  return [identifier, apiKey].join(SEPARATOR);
}
