import {Application, Controller} from 'https://unpkg.com/@hotwired/stimulus/dist/stimulus.js'

window.Stimulus = Application.start()

class AppInformationController extends Controller {
  static targets = ['url', 'scopes']

  initialize() {}

  async connect() {
    await this.updateAppInfo()
  }

  async updateAppInfo() {
    const appInfo = await (await fetch('/api/app-info')).json()
    this.urlTarget.textContent = appInfo.url
    this.urlTarget.href = appInfo.url
    this.scopesTarget.textContent = appInfo.scopes
  }
}

class WebhooksController extends Controller {
  static targets = []
  connect() {}
  async sendProductsCreateWebhook() {
    await fetch('/api/webhooks/products/create', {method: 'POST'})
  }
}

window.Stimulus.register('app-info', AppInformationController)
window.Stimulus.register('webhooks', WebhooksController)
