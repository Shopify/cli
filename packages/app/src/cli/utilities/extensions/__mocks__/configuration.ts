const config = {
  application_url: 'https://my-app-url.com',
}

export const LocalAppConfiguration = {
  getInstance: () => ({
    getFullConfig: () => config,
    getConfigValue: (path: keyof typeof config) => config[path],
    initializeConfig: () => {},
  }),
}
