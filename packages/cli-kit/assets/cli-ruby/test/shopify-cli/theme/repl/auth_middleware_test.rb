# frozen_string_literal: true

require "test_helper"
require "rack/mock"

require "shopify_cli/theme/dev_server"
require "shopify_cli/theme/repl/auth_dev_server"
require "shopify_cli/theme/repl/auth_middleware"

module ShopifyCLI
  module Theme
    class Repl
      class AuthMiddlewareTest < Minitest::Test
        def test_auth_middleware_when_users_open_other_pages
          repl.expects(:authenticate).with(storefront_session, secure_session)

          response = serve("/")

          assert_equal(200, response.status)
          assert_match("You've successfully activated the Shopify Liquid session", response.body)
        end

        def test_auth_middleware_when_users_open_the_password_page
          repl.expects(:authenticate).never

          response = serve("/password")

          assert_equal(200, response.status)
          assert_equal(page_body, response.body)
        end

        private

        def serve(url)
          request = Rack::MockRequest.new(auth_middleware)
          request.get(url, { "HTTP_COOKIE" => "storefront_digest=#{storefront_session}" })
        end

        def auth_middleware
          @auth_middleware ||= AuthMiddleware.new(app, proxy, repl) {}
        end

        def app
          @app ||= lambda { |_env| [200, {}, [page_body]] }
        end

        def page_body
          "<page>"
        end

        def proxy
          @proxy ||= stub(secure_session_id: secure_session, call: nil)
        end

        def secure_session
          @secure_session ||= "secure_session_id_1234"
        end

        def storefront_session
          @storefront_session ||= "storefront_session_5678"
        end

        def repl
          @repl ||= mock
        end
      end
    end
  end
end
