// interface ExtensionEvents {
//   type: 'updated' | 'deleted' | 'created'
//   extension: ExtensionInstance
// }

// import { AppInterface } from "../../../models/app/app.js"

// // TomlFileChangeHandler {
// //   (file) => {
// //       return ExtensionEvents[]
// //     }
// //   }
// // }

// interface AppEvent {
//   type: 'app_reload' | 'extension_reload' | 'extension_created' | 'extension_deleted'
//   app: AppInterface
//   extensionEvents
// }

// // Watcher(infra) => TomlFileChangedEvent      => ExtensionEvents
// //                => FunctionFileChangedEvent  => ExtensionEvents
// //                => NewExtensionEvent (reloadApp) =>
// //                => ExtensionChangeEvent (reloadsExtension) => ExtensionEvents

// function subscribeToAppEvents(app: AppInterface, handler: (event: AppEvent) => void) {
//   // ...
// }
