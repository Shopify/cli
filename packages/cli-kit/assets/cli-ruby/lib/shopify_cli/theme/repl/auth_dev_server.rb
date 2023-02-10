# frozen_string_literal: true

module ShopifyCLI
  module Theme
    class Repl
      class AuthDevServer < ShopifyCLI::Theme::DevServer
        attr_accessor :app, :repl

        class << self
          def start(ctx, repl, port)
            instance.repl = repl

            super(ctx, nil, port: port)
          end
        end

        private

        def middleware_stack
          @app = proxy
          @app = CdnFonts.new(app, theme: theme)
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
        def stop; end
        def sync_theme; end
      end
    end
  end
end
