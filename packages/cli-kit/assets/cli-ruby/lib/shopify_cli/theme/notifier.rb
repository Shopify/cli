# frozen_string_literal: true

require "uri"
require "net/http"

module ShopifyCLI
  module Theme
    class Notifier
      attr_reader :ctx, :path

      def initialize(ctx, path: nil)
        @ctx = ctx
        @path = path
      end

      def notify_updates(files)
        return if path.nil? || path.empty? || !path.is_a?(String)

        unless valid_url?(path)
          return notify_file(path)
        end

        response = notify_url(files)

        unless response.is_a?(Net::HTTPSuccess)
          ctx.puts(ctx.message("theme.serve.notifier.error", path, response.message))
        end

      rescue => error
        ctx.puts(ctx.message("theme.serve.notifier.error", path, error.message))
      end

      private

      def notify_url(files)
        Net::HTTP.post(URI(path), { "files" => files }.to_json, "Content-Type" => "application/json")
      end

      def notify_file(fname)
        ctx.write(fname, "")
        ctx.utime(Time.now, Time.now, fname)
      end

      def valid_url?(url)
        uri = URI.parse(url)
        uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
      rescue URI::InvalidURIError
        false
      end
    end
  end
end
