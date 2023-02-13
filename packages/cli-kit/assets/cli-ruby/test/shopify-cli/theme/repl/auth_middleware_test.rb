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
        def test_auth_middleware_when_user_is_authenticated
          password_page_mock = "<password page>"

          repl.expects(:authenticate).with(storefront_session, secure_session)

          response = serve(password_page_mock, "HTTP_COOKIE" => "storefront_digest=#{storefront_session}")

          assert_equal(200, response.status)
          assert_match("You've successfully activated the Shopify Liquid session", response.body)
        end

        def test_auth_middleware_when_user_is_not_authenticated
          password_page_mock = "<password page>"

          repl.expects(:authenticate).never

          response = serve(password_page_mock)

          assert_equal(200, response.status)
          assert_equal(password_page_mock, response.body)
        end

        private

        def serve(response_body, response_headers = {})
          app = lambda do |_env|
            [200, {}, [response_body]]
          end
          stack = AuthMiddleware.new(app, proxy, repl) {}
          request = Rack::MockRequest.new(stack)
          request.get("/", response_headers)
        end

        def proxy
          @proxy ||= stub(secure_session_id: secure_session)
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
