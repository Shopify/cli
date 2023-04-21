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
      end

      def test_makes_post_request_to_path_with_files
        request = stub_request_for_notify(@path, @files)

        notifier = Notifier.new(@ctx, path: @path)
        notifier.notify_updates(@files)

        assert_requested request
      end

      def test_updates_file_atime_and_mtime
        @ctx.root = Dir.mktmpdir
        path = "theme.update"
        freeze_time = Time.utc(2023, 4, 20, 12, 0, 0)
        Time.stubs(:now).returns(freeze_time)

        @ctx.expects(:utime).with(freeze_time, freeze_time, path)

        notifier = Notifier.new(@ctx, path: path)
        notifier.notify_updates(@files)
      end

      def test_does_not_notify_if_path_is_nil
        notifier = Notifier.new(@ctx, path: nil)
        notifier.expects(:notify_url).never

        notifier.notify_updates(@files)
      end

      def test_prints_error_if_response_is_not_success
        stub_request_for_notify(@path, @files).to_return(status: [500, "Internal Server Error"])

        @ctx.expects(:puts).with(@ctx.message("theme.serve.notifier.error", @path, "Internal Server Error"))

        notifier = Notifier.new(@ctx, path: @path)
        notifier.notify_updates(@files)
      end

      def test_prints_error_if_request_fails
        stub_request_for_notify(@path, @files).to_raise(StandardError.new("error"))

        @ctx.expects(:puts).with(@ctx.message("theme.serve.notifier.error", @path, "error"))

        notifier = Notifier.new(@ctx, path: @path)
        notifier.notify_updates(@files)
      end

      def test_prints_error_if_file_path_is_invalid
        @ctx.root = Dir.mktmpdir
        path = "dir/file:theme.update"

        @ctx.expects(:puts).with(regexp_matches(/No such file or directory/))

        notifier = Notifier.new(@ctx, path: path)
        notifier.notify_updates(@files)
      end

      private

      def stub_request_for_notify(path, files)
        stub_request(:post, path)
          .with(
            body: { "files" => files  }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end
    end
  end
end
