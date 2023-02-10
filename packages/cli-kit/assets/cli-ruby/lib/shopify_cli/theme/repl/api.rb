# frozen_string_literal: true

module ShopifyCLI
  module Theme
    class Repl
      class Api
        attr_reader :ctx, :repl

        def initialize(ctx, repl)
          @ctx = ctx
          @repl = repl
        end

        def request(liquid_snippet)
          Net::HTTP.start(uri.host, 443, use_ssl: true) do |http|
            req = Net::HTTP::Post.new(uri)

            req.initialize_http_header(headers)
            req.set_form_data(form_data(liquid_snippet))
            res = http.request(req)

            debug(res)

            res
          end
        end

        private

        def debug(response)
          return response unless debug?

          ctx.debug(<<~DEBUG)
            URI: #{uri}
            ---
            HTTP status: #{response.code}
            ---
            Response body:
            #{response.body}
          DEBUG

          response
        end

        def debug?
          @is_debug ||= ctx.debug?
        end

        def form_data(liquid_snippet)
          template = ["", "", liquid_snippet, "", liquid_template].join("\n")

          {
            "replace_templates[sections/announcement-bar.liquid]" => template,
            :_method => "GET",
          }
        end

        def liquid_template
          @liquid_template ||= ::File.read("#{__dir__}/resources/template.liquid")
        end

        def cookie
          @cookie ||= "storefront_digest=#{repl.storefront_digest}; _secure_session_id=#{repl.secure_session_id}"
        end

        def shop
          @shop ||= ShopifyCLI::Theme::ThemeAdminAPI.new(ctx).get_shop_or_abort
        end

        def storefront_renderer_token
          @storefront_renderer_token ||= ShopifyCLI::Environment.storefront_renderer_auth_token ||
            ShopifyCLI::DB.get(:storefront_renderer_production_exchange_token)
        end

        def headers
          @headers ||= if Environment.theme_access_password?
            {
              "Cookie" => cookie,
              "X-Shopify-Access-Token" => Environment.admin_auth_token,
              "X-Shopify-Shop" => shop,
            }
          else
            {
              "Cookie" => cookie,
              "Authorization" => "Bearer #{storefront_renderer_token}",
              "User-Agent" => "Shopify CLI",
            }
          end
        end

        def uri
          return @api_uri if @api_uri

          uri_address = if Environment.theme_access_password?
            "https://#{ThemeAccessAPI::BASE_URL}/cli/sfr"
          else
            "https://#{shop}"
          end

          @api_uri = URI(uri_address)
          @api_uri.query = URI.encode_www_form([["section_id", "announcement-bar"], [:_fd, 0], [:pb, 0]])
          @api_uri
        end
      end
    end
  end
end
