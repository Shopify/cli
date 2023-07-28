# frozen_string_literal: true

module ShopifyCLI
  module Theme
    class Repl
      class AuthMiddleware
        PASSWORD_PAGE_PATH = "/password"

        def initialize(app, proxy, repl, &stop_dev_server)
          @app = app
          @proxy = proxy
          @repl = repl
          @stop_dev_server = stop_dev_server
        end

        def call(env)
          @env = env
          @env["PATH_INFO"] = PASSWORD_PAGE_PATH if redirect_to_password?(@env)

          return @app.call(@env) if password_page?(@env)

          authenticate!

          # The authentication server only shuts down when the root page is
          # loaded, preventing favicons or other assets on the /password page
          # from shutting down the server.
          shutdown if index_page?(@env)

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

        def redirect_to_password?(env)
          return false if defined?(@redirect_to_password)

          code, _body, _resp = @proxy.call({ **env, "PATH_INFO" => "/" })

          @redirect_to_password = code == "302"
        end

        def storefront_session
          cookie["storefront_digest"]&.first
        end

        def secure_session
          @proxy.secure_session_id
        end

        def authenticate!
          @repl.authenticate(storefront_session, secure_session)
        end

        def password_page?(env)
          env["PATH_INFO"]&.start_with?(PASSWORD_PAGE_PATH)
        end

        def index_page?(env)
          env["PATH_INFO"] == "/"
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
        rescue StandardError
          []
        end
      end
    end
  end
end
