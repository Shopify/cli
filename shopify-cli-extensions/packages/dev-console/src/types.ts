// SHARED

export interface ExtensionManifest {
  apiKey: string;
  rendererVersion: string;
  argoVersion?: string;
  identifier: string;
  scriptUrl: URL | string | null;
  name: string;
  resourceUrl?: string;
  uuid?: string;
  stats: string;
  mobile: string;
  data: string;
}

export enum Status {
  Connected = 'Connected',
  Disconnected = 'Disconnected',
  BuildError = 'BuildError',
}

export interface App {
  id: string;
  apiKey: string;
  applicationUrl: string;
  handle?: string | null;
  title: string;
  developerName?: string;
  icon: {
    transformedSrc: string;
  };
  installation?: {
    launchUrl: string;
  };
  supportEmail?: string;
  supportLocales?: string[];
}

export interface ExtensionManifestData extends ExtensionManifest {
  app: App;
  status?: Status.Connected | Status.Disconnected | Status.BuildError;
  focused?: boolean;
  hidden?: boolean;
}
