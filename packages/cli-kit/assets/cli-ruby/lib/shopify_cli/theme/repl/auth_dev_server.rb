# frozen_string_literal: true

module ShopifyCLI
  module Theme
    class Repl
      class AuthDevServer < ShopifyCLI::Theme::DevServer
        attr_accessor :app, :repl

        REPL_THEME = "liquid-console-repl"

        class << self
          def start(ctx, repl, port)
            instance.repl = repl

            super(ctx, nil, port: port, theme: REPL_THEME)
          end
        end

        private

        def theme
          @theme ||= find_repl_theme || create_repl_theme
        end

        def find_repl_theme
          Theme.find(ctx, nil) do |theme_hash|
            theme_hash["name"] == theme_identifier && theme_hash["role"] == "development"
          end
        end

        def create_repl_theme
          repl_theme = Theme.new(ctx, name: theme_identifier, role: "development")
          repl_theme.create

          api_client = ThemeAdminAPI.new(ctx, repl_theme.shop)
          status, _body, _response = api_client.put(
            path: "themes/#{repl_theme.id}/assets/bulk.json",
            method: "PUT",
            body: JSON.generate({
              assets: [
                { key: "sections/announcement-bar.liquid", value: "" },
                { key: "config/settings_schema.json", value: "[]" },
                { key: "config/settings_data.json", value: "{}" },
                { key: "layout/theme.liquid", value: "{{ content_for_header }}{{ content_for_layout }}" },
                { key: "layout/password.liquid", value: "{{ content_for_header }}{{ content_for_layout }}" },
              ],
            }),
          )

          if status != 207
            ctx.puts("{{red:Shopify Liquid console could not be initiatilize (HTTP status: #{status})}}")
            raise ShopifyCLI::AbortSilent
          end

          repl_theme
        end

        def middleware_stack
          @app = proxy
          @app = CdnFonts.new(ctx, app, theme: theme)
          @app = AuthMiddleware.new(app, proxy, repl) { WebServer.shutdown }
        end

        def param_builder
          @param_builder ||= ProxyParamBuilder.new
        end

        def proxy
          @proxy ||= Proxy.new(ctx, theme, param_builder)
        end

        def frame_title; end
        def preview_message; end
        def setup_server; end
        def stop(_signal); end
        def sync_theme; end
      end
    end
  end
end
