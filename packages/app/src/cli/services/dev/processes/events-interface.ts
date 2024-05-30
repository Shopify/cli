// interface ExtensionEvents {
//   type: 'updated' | 'deleted' | 'created'
//   extension: ExtensionInstance
// }

// TomlFileChangeHandler {
//   (file) => {
//       return ExtensionEvents[]
//     }
//   }
// }

// interface AppEvent {
//   type: 'app'
//   app: AppInterface
// }

// Watcher(infra) => TomlFileChangedEvent      => ExtensionEvents
//                => FunctionFileChangedEvent  => ExtensionEvents
//                => NewExtensionEvent (reloadApp) =>
//                => ExtensionChangeEvent (reloadsExtension) => ExtensionEvents
