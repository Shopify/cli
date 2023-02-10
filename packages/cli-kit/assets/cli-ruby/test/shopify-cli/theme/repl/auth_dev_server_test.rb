# frozen_string_literal: true

require "test_helper"

require "shopify_cli/theme/dev_server"
require "shopify_cli/theme/repl/auth_dev_server"
require "shopify_cli/theme/repl/auth_middleware"

module ShopifyCLI
  module Theme
    class Repl
      class AuthDevServerTest < Minitest::Test
        CdnFonts = AuthDevServer::CdnFonts
        AuthMiddleware = Repl::AuthMiddleware

        def test_middleware_stack
          server = dev_server
          server.stubs(:theme).returns(stub)

          middleware_sequence = sequence("middleware sequence")

          CdnFonts.expects(:new).in_sequence(middleware_sequence)
          AuthMiddleware.expects(:new).in_sequence(middleware_sequence)

          server.send(:middleware_stack)
        end

        def teardown
          TestHelpers::Singleton.reset_singleton!(AuthDevServer.instance)
        end

        private

        def dev_server
          server = AuthDevServer.instance
          server.setup(ctx, *[nil] * 11)

          server
        end

        def ctx
          @ctx ||= ShopifyCLI::Context.new
        end
      end
    end
  end
end
