# frozen_string_literal: true

module ShopifyCLI
  module Theme
    class DevServer
      class CdnFonts
        FONTS_PATH = "/fonts"
        FONTS_CDN = "https://fonts.shopifycdn.com"

        def initialize(ctx, app, theme:)
          @ctx = ctx
          @app = app
          @theme = theme
        end

        def call(env)
          path = env["PATH_INFO"]

          # Serve from fonts CDN
          return serve_font(env) if path.start_with?(FONTS_PATH)

          # Proxy the request, and replace the URLs in the response
          status, headers, body = @app.call(env)
          content_type = headers["Content-Type"] || headers["content-type"]
          if content_type.nil? || content_type == "" || content_type&.start_with?("text/")
            [status, headers, replace_font_urls(body)]
          else
            [status, headers, body]
          end
        end

        private

        def serve_font(env)
          parameters = %w(PATH_INFO QUERY_STRING REQUEST_METHOD rack.input)
          path, query, method, body_stream = *env.slice(*parameters).values

          uri = fonts_cdn_uri(path, query)

          response = Net::HTTP.start(uri.host, 443, use_ssl: true) do |http|
            req_class = Net::HTTP.const_get(method.capitalize)
            req = req_class.new(uri)
            req.initialize_http_header(fonts_cdn_headers)
            req.body_stream = body_stream
            http.request(req)
          end

          [
            response.code.to_s,
            {
              "Content-Type" => response.content_type,
              "Content-Length" => response.content_length.to_s,
            },
            [response.body],
          ]
        end

        def fonts_cdn_headers
          {
            "Referer" => "https://#{@theme.shop}",
            "Transfer-Encoding" => "chunked",
          }
        end

        def fonts_cdn_uri(path, query)
          uri = URI.join("#{FONTS_CDN}/", path.gsub(%r{^#{FONTS_PATH}\/}, ""))
          uri.query = query.split("&").last
          uri
        end

        def replace_font_urls(body)
          fonts_regex = %r{#{FONTS_CDN}|((http:|https:)?//#{shop}/cdn/fonts)}
          [body.join.gsub(fonts_regex, FONTS_PATH)]
        end

        def shop
          @shop ||= ShopifyCLI::Theme::ThemeAdminAPI.new(@ctx).get_shop_or_abort
        end
      end
    end
  end
end
