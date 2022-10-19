# Shopify UI Extensions Server Kit

This library provides components and utilities for connecting to the UI Extensions Dev Server. This is used internally by the Dev Console that's provided when developing UI Extensions. The library allows the consumer to fetch information about the running extensions and subscribe to updates.

## Installation

When consumed in a project, the command `ui-extensions-server-kit` becomes available to the project. The command can be used to build UI Extensions.

To install this package in an UI Extension project, run:

```sh
npm install @shopify/ui-extensions-server-kit
```

or

```sh
yarn add @shopify/ui-extensions-server-kit
```

## Connecting to the Dev Server

Import the `ExtensionServerProvider` component and pass a the Dev Server's websocket url. Once this is set, child components inside the `ExtensionServerProvider` can use the `useExtensionServerContext` hook to connect to the Dev Server and fetch the locally running extensions.

```tsx
import {ExtensionServerProvider, useExtensionServerContext} from '@shopify/ui-extensions-server-kit';

function LocalExensionsComponent() {
  const {state: {extensions}} = useExtensionServerContext();

  // TODO: Something with the extensions
  return null;
}

function App() {
  const connectionOptions = useMemo(() => {
    /**
     * The Dev Server url is usually passed as a search param and then saved
     * in local/session storage. You can also leave this blank if you don't have access to the socket url when the ExtensionServerProvider is mounted.
     */
     return {
      connection: {
        url: 'wss://dev-server-socket-url',
        automaticConnect: false, // Set this to false if you don't want to connect immediately.
      },
      surface: 'Admin', // Optionally filter for extensions in a specific surface
     }
  }, []);

  return (<ExtensionServerProvider options={connectionOptions}>
            <LocalExensionsComponent/>
          </ExtensionServerProvider>);
}
```

## Subscribing to events

The `useExtensionServerContext` hook provides a client you can use to subscribe to events dispatched by the Extension Server. You most likely don't need to subscribe to events manually but this is documented for completion.

```tsx
function LocalExensionsComponent() {
  const {client} = useExtensionServerContext();

  useEffect(() => {
    return client.on(
      'connected',
      async ({app, extensions}) => {
         // Dispatched once when the connection to the Dev Server is established
      },
    );
  }, [client]);

  useEffect(() => {
    return client.on(
      'update',
      async ({app, extensions}) => {
         /**
         * Dispatched everytime an extension has been updated. Update events can happen as a result of the following:
         * - extension script has changed
         * - localization JSON has changed
         * - clicking on the show/hide button in the Dev Console
         */
      },
    );
    return unsubscribeUpdate;
  }, [client]);

  return null;
}
```

## Auto-update of extensions

By default the `useExtensionServerContext` handles different events and keep the extension state up to date so you don't have to manually subscribe to events:

- Live reloading: The asset urls for extensions are appended with a new timestamp whenever the JS bundle is rebuilt and an `update` event is dispatched
- Focus: The `focused` property is set to to `true` when a `focus` event is dispatched
- Unfocus: The `focused` property is set to to `false` when an `unfocus` event is dispatched
- Refresh: The asset urls for extensions are appended with a new timestamp whenever a `refresh` event is dispatched


## Persisting data updates

The `useExtensionServerContext` hook provides a client you can use to mutate the data for the current app or extensions. This is used to provide new data to the Dev Server that can only be set by the runtime context of the extension.

```tsx
function LocalExensionsComponent() {
  const {client} = useExtensionServerContext();

  // Call this function to persist data changes to the Dev Server
  const updateExtensions = useCallback(() => {
    client.persist('update', {
      // Update the app title
      app: {title: 'My app'},
      // Update the development resource url
      extensions: [{development: {resource: {url: '/admin/product/1'}}}],
    });
  }, [client]);

  return null;
}
```

## Emiting short-lived events

The `useExtensionServerContext` hook provides a client you can use to emit transient events to the Dev Server that can be dispatched to all listeners. Here is an example of how the Dev Console work with Admin to handle the navigation event on an extension:

```tsx
function DevConsole() {
  const {client, extensions: [extension]} = useExtensionServerContext();

  const navigateToExtension = useCallback(() => {
    client.emit('navigate', {url: extension.development.resource.url});
  },[extension]);

  return <button onClick={navigateToExtension}>Navigate to the extension</button>
}

function AdminLocalExensionsComponent() {
  const {client} = useExtensionServerContext();

   useEffect(() => {
    return client.on('navigate', ({url}) => {
      if (!url) {
        return;
      }
      // Navigate to the url
      window.location.assign(url);
    });
  }, [client]);

  return null;
}

```
