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

        def setup
          super

          Environment.stubs(:store).returns("store.myshopify.com")
          ShopifyCLI::DB.stubs(:get).with(:shopify_exchange_token).returns("token123")
          ShopifyCLI::DB.stubs(:get).with(:acting_as_shopify_organization).returns(nil)
        end

        def test_middleware_stack
          server = dev_server
          server.stubs(:theme).returns(stub)

          middleware_sequence = sequence("middleware sequence")

          CdnFonts.expects(:new).in_sequence(middleware_sequence)
          AuthMiddleware.expects(:new).in_sequence(middleware_sequence)

          server.send(:middleware_stack)
        end

        def test_theme_when_repl_theme_exists
          Theme.stubs(:fetch_themes).returns([
            200,
            {
              "themes" => [
                { "id" => "1", "name" => "some theme", "role" => "development" },
                { "id" => "2", "name" => "liquid-console-repl", "role" => "unpublished" },
                { "id" => "3", "name" => "liquid-console-repl", "role" => "development" },
              ],
            },
          ])

          theme = dev_server.send(:theme)

          assert_equal("3", theme.id)
        end

        def test_theme_when_repl_theme_does_not_exist
          Theme.stubs(:fetch_themes).returns([
            200,
            {
              "themes" => [
                { "id" => "1", "name" => "some theme", "role" => "development" },
                { "id" => "2", "name" => "liquid-console-repl", "role" => "unpublished" },
              ],
            },
          ])

          mock_theme_creation
          mock_theme_assets_creation

          theme = dev_server.send(:theme)

          assert_equal("10", theme.id)
        end

        def teardown
          TestHelpers::Singleton.reset_singleton!(AuthDevServer.instance)
        end

        private

        def dev_server
          AuthDevServer.instance.tap do |server|
            server.stubs(:ctx).returns(ctx)
            server.stubs(:theme_identifier).returns("liquid-console-repl")
          end
        end

        def ctx
          @ctx ||= ShopifyCLI::Context.new
        end

        def mock_theme_creation
          stub_request(:post, "https://store.myshopify.com/admin/api/unstable/themes.json")
            .with(
              body: {
                "theme": {
                  "name": "liquid-console-repl",
                  "role": "development",
                },
              }.to_json,
            )
            .to_return(
              status: 207,
              body: {
                theme: {
                  id: "10",
                  name: "liquid-console-repl",
                },
              }.to_json,
              headers: {},
            )
        end

        def mock_theme_assets_creation
          stub_request(:put, "https://store.myshopify.com/admin/api/unstable/themes/10/assets/bulk.json")
            .with(
              body: {
                "assets": [
                  {
                    "key" => "config/settings_data.json",
                    "value" => "{}",
                  },
                  {
                    "key" => "config/settings_schema.json",
                    "value" => "[]",
                  },
                  {
                    "key" => "snippets/eval.liquid",
                    "value" => "",
                  },
                  {
                    "key" => "layout/password.liquid",
                    "value" => "{{ content_for_header }}{{ content_for_layout }}",
                  },
                  {
                    "key" => "layout/theme.liquid",
                    "value" => "{{ content_for_header }}{{ content_for_layout }}",
                  },
                  {
                    "key" => "sections/announcement-bar.liquid",
                    "value" => "",
                  },
                  {
                    "key" => "templates/index.json",
                    "value" => {
                      "sections" => {
                        "a" => { "type" => "announcement-bar", "settings" => {} },
                      },
                      "order" => ["a"],
                    }.to_json,
                  },
                ],
              }.to_json,
            )
            .to_return(status: 207, body: "[]")
        end
      end
    end
  end
end
