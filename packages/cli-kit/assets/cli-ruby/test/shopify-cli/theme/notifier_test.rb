require "test_helper"
require "shopify_cli/http_request"

module ShopifyCLI
  module Theme
    class NotifierTest < Minitest::Test
      def setup
        super
        root = ShopifyCLI::ROOT + "/test/fixtures/theme"
        @ctx = TestHelpers::FakeContext.new(root: root)
        @path = "https://example.com/notify"
        @files = ["announcement.liquid"]
        @notifier = Notifier.new(@ctx, path: @path)
      end

      def test_makes_post_request_to_path_with_files
        request = stub_request(:post, @path)
          .with(
            body: { "files" => @files }.to_json,
            headers: { "Content-Type" => "application/json" }
          )

        @notifier.notify_updates(@files)

        assert_requested request
      end

      def test_does_not_notify_if_path_is_nil
        @notifier = Notifier.new(@ctx, path: nil)
        @notifier.expects(:notify_url).never

        @notifier.notify_updates(@files)
      end

      def test_prints_error_if_response_is_not_success
        stub_request(:post, @path)
          .with(
            body: { "files" => @files }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
          .to_return(status: 500)

        @ctx.expects(:puts).with(@ctx.message("theme.serve.notifier.error", @path, ""))

        @notifier.notify_updates(@files)
      end
    end
  end
end
