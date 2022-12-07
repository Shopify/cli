import fetch from 'node-fetch'
import * as vscode from 'vscode'

/**
 * Workshop references
 *   - VSCode APIs: https://code.visualstudio.com/api/references/vscode-api
 *   - Activation events: https://code.visualstudio.com/api/references/activation-events
 *   - Contribution points: https://code.visualstudio.com/api/references/contribution-points
 *
 * Ideas
 *   - Show the app URL when "dev" is running
 *   - Add visual workflow to add a new extension to a project
 *      - https://code.visualstudio.com/api/references/contribution-points#contributes.commands
 *   - Show a walkthrough view:
 *      - https://code.visualstudio.com/api/references/contribution-points#contributes.viewsWelcome
 *   - Add a sub-menu to open the extension that the user is currently editing
 *      - https://code.visualstudio.com/api/references/contribution-points#contributes.submenus
 */

export class ShopifyCLIExtension {
  disposables: vscode.Disposable[]
  timers: NodeJS.Timer[]

  constructor() {
    this.disposables = []
    this.timers = []

    const workspaceRoot = vscode.workspace.getWorkspaceFolder(
      vscode.window.activeTextEditor?.document.uri as vscode.Uri,
    )?.uri.fsPath as string
    const commandDisposable = vscode.commands.registerCommand('shopify-cli-vscode-extension.helloWorld', () => {
      vscode.window.showInformationMessage('Hello World from vscode-extension!')
    })
    const commandShowTomlDoc = vscode.commands.registerCommand('shopify-cli-vscode-extension.showTomlDoc', () => {
      const editor = vscode.window.activeTextEditor
      if (editor) {
        let document = editor.document
        const documentText = document.getText()
        vscode.window.showInformationMessage(documentText)
      }
      vscode.env.openExternal(vscode.Uri.parse('https://shopify.dev/apps/tools/cli/migrate#shopify-web-toml'))
    })
    const devToolsTreeDataProvider = new DevToolsTreeDataProvider()
    const devToolsDisposable = vscode.window.createTreeView('dev-tools', {
      treeDataProvider: devToolsTreeDataProvider,
    })

    this.disposables.push(commandDisposable)
    this.disposables.push(commandShowTomlDoc)
    this.disposables.push(devToolsDisposable)
    this.timers.push(
      setInterval(() => {
        devToolsTreeDataProvider.refresh()
      }, 5000),
    )
  }

  // Values returned in the callback of `hotRequire` must
  // have a `dispose` function.
  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose())
    this.timers.forEach(clearInterval)
  }
}

export class DevToolsTreeDataProvider implements vscode.TreeDataProvider<DevTool> {
  private _onDidChangeTreeData: vscode.EventEmitter<DevTool | undefined> = new vscode.EventEmitter<
    DevTool | undefined
  >()

  readonly onDidChangeTreeData: vscode.Event<DevTool | undefined> = this._onDidChangeTreeData.event

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined)
  }

  constructor() {}

  getTreeItem(element: DevTool): vscode.TreeItem {
    return element
  }

  async getChildren(element?: DevTool): Promise<DevTool[]> {
    try {
      const response = await fetch('http://localhost:1111/vscode')
      const json = (await response.json()) as any
      return json.map((item: any) => new DevTool(item.title, vscode.TreeItemCollapsibleState.None))
    } catch (error: any) {
      return [new DevTool(`No dev running`, vscode.TreeItemCollapsibleState.None)]
    }
  }
}

class DevTool extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState)
    this.tooltip = `${this.label}`
    this.description = this.label
  }
}
