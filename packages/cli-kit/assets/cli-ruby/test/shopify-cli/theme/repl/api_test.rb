# frozen_string_literal: true

require "test_helper"

require "shopify_cli/theme/theme_admin_api"
require "shopify_cli/theme/repl/api"

module ShopifyCLI
  module Theme
    class Repl
      class ApiTest < Minitest::Test
        def setup
          super

          Environment.stubs(:store).returns("store.myshopify.com")

          @api = Api.new(ctx, "/", repl)
          @api.stubs(:liquid_template).returns("<liquid_template>")
        end

        def test_request_when_logged_in_with_theme_access
          stub_request(:post, "https://store.myshopify.com/?_fd=0&pb=0&section_id=announcement-bar")
            .with(
              body: {
                "_method" => "GET",
                "replace_templates" => {
                  "snippets/eval.liquid" => "\n{{ 123 }}\n",
                  "sections/announcement-bar.liquid" => "\n{% render 'eval' %}<liquid_template>",
                },
              },
              headers: {
                "Authorization" => "Bearer",
                "Content-Type" => "application/x-www-form-urlencoded",
                "Cookie" => "storefront_digest=storefront_session_5678; _secure_session_id=secure_session_id_1234",
                "User-Agent" => "Shopify CLI",
              },
            )
            .to_return(status: 200, body: "123", headers: {})

          response = @api.request("{{ 123 }}")

          assert_equal("200", response.code)
          assert_equal("123", response.body)
        end

        def test_request_when_not_logged_in_with_theme_access
          Environment.stubs(:theme_access_password?).returns(true)

          stub_request(:post, "https://theme-kit-access.shopifyapps.com/cli/sfr/?_fd=0&pb=0&section_id=announcement-bar")
            .with(
              body: {
                "_method" => "GET",
                "replace_templates" => {
                  "snippets/eval.liquid" => "\n{{ 456 }}\n",
                  "sections/announcement-bar.liquid" => "\n{% render 'eval' %}<liquid_template>",
                },
              },
              headers: {
                "Content-Type" => "application/x-www-form-urlencoded",
                "Cookie" => "storefront_digest=storefront_session_5678; _secure_session_id=secure_session_id_1234",
                "X-Shopify-Shop" => "store.myshopify.com",
              },
            )
            .to_return(status: 200, body: "456", headers: {})

          response = @api.request("{{ 456 }}")

          assert_equal("200", response.code)
          assert_equal("456", response.body)
        end

        private

        def ctx
          @ctx ||= ShopifyCLI::Context.new
        end

        def repl
          @repl ||= stub(storefront_digest: "storefront_session_5678", secure_session_id: "secure_session_id_1234")
        end
      end
    end
  end
end
