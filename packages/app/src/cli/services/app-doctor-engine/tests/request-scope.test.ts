import {scanRequestDerivedShopScope} from '../rules/request-scope-rules.js'
import {describe, expect, test} from 'vitest'
import type {SourceFile} from '../rules/types.js'

const rb = (content: string, path = 'app/controllers/things_controller.rb'): SourceFile => ({
  path,
  absolutePath: `/tmp/${path}`,
  ext: '.rb',
  content,
})

const run = (content: string, path?: string) => scanRequestDerivedShopScope([rb(content, path)])

describe('REQUEST_DERIVED_SHOP_SCOPE', () => {
  test('flags a query whose shop scope comes straight from params', () => {
    const issues = run(`
      class ThingsController < ApplicationController
        def destroy
          Token.where(shop_id: params[:shop_id]).delete_all
        end
      end
    `)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.confidence).toBe('needs_review')
    expect(issues[0]?.id).toBe('REQUEST_DERIVED_SHOP_SCOPE')
  })

  test('flags find_by with a request-supplied shop alongside other conditions', () => {
    const issues = run(`
      class ThingsController < ApplicationController
        def show
          token = Token.find_by(shop_id: params[:shop_id], app: app_type)
        end
      end
    `)
    expect(issues).toHaveLength(1)
  })

  test('does not flag a query scoped by the authenticated session', () => {
    const issues = run(`
      class ThingsController < ApplicationController
        def index
          Token.where(shop_id: current_shop.id).to_a
        end
      end
    `)
    expect(issues).toHaveLength(0)
  })

  test('does not flag looking up the tenant record itself during install', () => {
    const issues = run(`
      class ThingsController < ApplicationController
        def callback
          @shop = Shop.find_by(shopify_domain: params[:shop])
        end
      end
    `)
    expect(issues).toHaveLength(0)
  })

  test('follows a request-bound local within the same method', () => {
    const issues = run(`
      class ThingsController < ApplicationController
        def destroy
          shop_id = params[:shop_id]
          Token.where(shop_id: shop_id).delete_all
        end
      end
    `)
    expect(issues).toHaveLength(1)
  })

  test('does not leak a binding into a method that shadows the name as a parameter', () => {
    // Regression: Flow assigns shop_id = params[:shop_id] in update_cookie,
    // and save_access_token later takes shop_id as its own parameter. A
    // file-global binding map flagged the second, safe call site.
    const issues = run(`
      class ThingsController < ApplicationController
        def update_cookie
          shop_id = params[:shop_id]
          cookies.signed[:shop_id] = shop_id
        end

        def save_access_token(shop_id, access_token)
          row = Token.find_or_initialize_by(shop_id: shop_id, app: app_type)
          row.save!
        end
      end
    `)
    expect(issues).toHaveLength(0)
  })

  test('clears a binding when the local is reassigned from a trusted source', () => {
    const issues = run(`
      class ThingsController < ApplicationController
        def index
          shop_id = params[:shop_id]
          shop_id = current_shop.id
          Token.where(shop_id: shop_id).to_a
        end
      end
    `)
    expect(issues).toHaveLength(0)
  })

  test('ignores non-controller files', () => {
    const issues = run(`Token.where(shop_id: params[:shop_id]).delete_all`, 'app/models/token.rb')
    expect(issues).toHaveLength(0)
  })

  test('ignores test files', () => {
    const issues = run(
      `
      class ThingsControllerTest < ActionDispatch::IntegrationTest
        def test_thing
          Token.where(shop_id: params[:shop_id]).delete_all
        end
      end
      `,
      'test/controllers/things_controller_test.rb',
    )
    expect(issues).toHaveLength(0)
  })

  test('ignores commented-out code', () => {
    const issues = run(`
      class ThingsController < ApplicationController
        def destroy
          # Token.where(shop_id: params[:shop_id]).delete_all
        end
      end
    `)
    expect(issues).toHaveLength(0)
  })
})
