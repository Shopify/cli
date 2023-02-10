# frozen_string_literal: true

module ShopifyCLI
  module Theme
    class Repl
      class AuthMiddleware
        def initialize(app, proxy, repl, &stop_dev_server)
          @app = app
          @proxy = proxy
          @repl = repl
          @stop_dev_server = stop_dev_server
        end

        def call(env)
          @env = env

          return @app.call(env) unless authenticated?

          authenticate!
          shutdown

          [
            200,
            {
              "Content-Type" => "text/html",
              "Content-Length" => success_body.size.to_s,
            },
            [success_body],
          ]
        end

        def close
          @app.close
        end

        private

        def storefront_session
          cookie["storefront_digest"]&.first
        end

        def secure_session
          @proxy.secure_session_id
        end

        def authenticated?
          storefront_session && secure_session
        end

        def authenticate!
          @repl.authenticate(storefront_session, secure_session)
        end

        def shutdown
          Thread.new do
            # Web server answers the request and shutdown itself
            sleep(1)

            @stop_dev_server.call
          end
        end

        def success_body
          @success_body ||= ::File.read("#{__dir__}/resources/success.html")
        end

        def cookie
          CGI::Cookie.parse(@env["HTTP_COOKIE"])
        end
      end
    end
  end
end
