# frozen_string_literal: true

require "test_helper"
require "shopify_cli/theme/extension/dev_server"

module ShopifyCLI
  module Theme
    module Extension
      class DevServerTest < Minitest::Test
        def setup
          super
          @app_id = "app_0000"
          @api_key = "api_key_1234"
          @location = "http://location:1234"
          @registration_id = "registration_id_5678"
          @theme_editor_url = "https://test.myshopify.io/editor"
          @server_host = "127.0.0.1"
          @server_port = 9292
        end

        def test_middleware_stack
          server = dev_server
          server.stubs(:theme).returns(stub)
          server.stubs(:extension).returns(stub(root: nil, extension_files: []))
          server.stubs(:watcher).returns(stub)

          middleware_sequence = sequence("middleware sequence")

          DevServer::Proxy.expects(:new).in_sequence(middleware_sequence)
          DevServer::CdnFonts.expects(:new).in_sequence(middleware_sequence)
          Extension::DevServer::LocalAssets.expects(:new).in_sequence(middleware_sequence)
          DevServer::HotReload.expects(:new).in_sequence(middleware_sequence)

          server.send(:middleware_stack)
        end

        def test_theme_when_theme_does_not_exist
          mock_theme_by_identifier(identifier: theme.id, result: nil)

          error = assert_raises(CLI::Kit::Abort) do
            dev_server(identifier: theme.id).send(:theme)
          end

          assert_equal("{{x}} Theme \"1234\" doesn't exist", error.message)
        end

        def test_theme_with_valid_theme_id
          mock_theme_by_identifier(identifier: theme.id, result: theme)

          dev_server(identifier: theme.id).send(:theme)
        end

        def test_instructions_when_shopifyfolk_and_unified_deployments
          mock_theme_extension_registrations(response: theme_extension_registrations_response)
          mock_theme_by_identifier(identifier: theme.name, result: theme)
          Shopifolk.stubs(:acting_as_shopify_organization?).returns(true)
          Environment.stubs(:unified_deployment?).returns(true)

          ctx
            .expects(:message)
            .with("serve.preview_message_1p_unified", "http://location/9082/impersonate", @theme_editor_url, "http://#{@server_host}:#{@server_port}")

          dev_server(identifier: theme.name).send(:preview_message)
        end

        def test_instructions_when_shopifyfolk_and_non_unified_deployments
          mock_theme_extension_registrations(response: theme_extension_registrations_response)
          mock_theme_by_identifier(identifier: theme.name, result: theme)
          Shopifolk.stubs(:acting_as_shopify_organization?).returns(true)

          ctx
            .expects(:message)
            .with("serve.preview_message_1p", "http://location/9082/impersonate", @location, @theme_editor_url, "http://#{@server_host}:#{@server_port}")

          dev_server(identifier: theme.name).send(:preview_message)
        end

        def test_instructions_when_non_shopifyfolk_and_unified_deployments
          mock_theme_by_identifier(identifier: theme.name, result: theme)
          Environment.stubs(:unified_deployment?).returns(true)

          ctx
            .expects(:message)
            .with("serve.preview_message_unified", @theme_editor_url, "http://#{@server_host}:#{@server_port}")

          dev_server(identifier: theme.name).send(:preview_message)
        end

        def test_instructions_when_non_shopifyfolk_and_non_unified_deployments
          mock_theme_extension_registrations(response: theme_extension_registrations_response)
          mock_theme_by_identifier(identifier: theme.name, result: theme)

          ctx
            .expects(:message)
            .with("serve.preview_message", @location, @theme_editor_url, "http://#{@server_host}:#{@server_port}")

          dev_server(identifier: theme.name).send(:preview_message)
        end

        def test_theme_with_valid_theme_name
          mock_theme_by_identifier(identifier: theme.name, result: theme)

          dev_server(identifier: theme.name).send(:theme)
        end

        def test_finds_or_creates_a_dev_theme_when_no_theme_specified
          HostTheme
            .expects(:find_by_identifier).never
          HostTheme
            .expects(:find_or_create!)
            .with(ctx).once

          dev_server.send(:theme)
        end

        def test_extension_when_it_is_created
          mock_theme_extension_registrations(response: theme_extension_registrations_response)

          extension1 = dev_server.send(:extension)
          extension2 = dev_server.send(:extension)

          assert_same(extension1, extension2)
          assert_equal(@app_id, extension1.app_id)
          assert_equal(@location, extension1.location)
          assert_equal(@registration_id, extension1.registration_id)
        end

        def test_extension_when_it_is_not_created
          mock_theme_extension_registrations(response: {
            "data" => {
              "error" => "error message",
            },
          })

          extension1 = dev_server.send(:extension)
          extension2 = dev_server.send(:extension)

          assert_same(extension1, extension2)
          assert_nil(extension1.app_id)
          assert_nil(extension1.location)
          assert_nil(extension1.registration_id)
        end

        def teardown
          TestHelpers::Singleton.reset_singleton!(Extension::DevServer.instance)
        end

        private

        def dev_server(identifier: nil)
          poll, editor_sync, overwrite_json, open_browser, stable, mode, ignores, includes, notify, nodelete = nil
          server = Extension::DevServer.instance
          server.setup(ctx, root, @server_host, identifier, @server_port, poll, editor_sync, overwrite_json,
            open_browser, stable, mode, ignores, includes, notify, nodelete)
          server.project = project
          server.specification_handler = specification_handler
          server
        end

        def project
          app = stub(api_key: @api_key)
          stub(app: app, registration_id: @registration_id)
        end

        def specification_handler
          stub(config: "config", identifier: "THEME_APP_EXTENSION", extension_context: "extension_context")
        end

        def ctx
          @ctx ||= ShopifyCLI::Context.new.tap do |context|
            context
              .stubs(:message)
              .with("theme.serve.theme_not_found", 1234)
              .returns("Theme \"1234\" doesn't exist")

            context
              .stubs(:message)
              .with("core.login.spinner.initiating")
              .returns("")
          end
        end

        def root
          "."
        end

        def theme
          @theme ||= stub(
            "Host Theme Testing",
            root: root,
            id: 1234,
            name: "HostTheme Test",
            shop: "test.myshopify.io",
            editor_url: @theme_editor_url,
            preview_url: "https://test.myshopify.io/preview",
            live?: false,
          )
        end

        def mock_theme_by_identifier(identifier:, result: nil)
          HostTheme
            .expects(:find_by_identifier)
            .with(ctx, identifier: identifier)
            .returns(result)
        end

        def mock_theme_extension_registrations(response:)
          ShopifyCLI::PartnersAPI
            .expects(:query)
            .with(
              ctx,
              "get_extension_registrations",
              api_key: @api_key,
              type: "theme_app_extension",
            )
            .returns(response)
        end

        def theme_extension_registrations_response
          {
            "data" => {
              "app" => {
                "id" => @app_id,
                "title" => "mock",
                "apiKey" => "00000000000",
                "apiSecretKeys" => [{ "secret" => "00000000000" }],
                "appType" => "public",
                "extensionRegistrations" => [
                  {
                    "id" => @registration_id,
                    "type" => "THEME_APP_EXTENSION",
                    "uuid" => "dac9b229-a4dc-4569-8d1b-d36102db719f",
                    "title" => "theme-app-extension",
                    "draftVersion" => {
                      "registrationId" => @registration_id,
                      "context" => nil,
                      "lastUserInteractionAt" => "1992-01-02T12:00:00-00:00",
                      "location" => @location,
                      "validationErrors" => [],
                      "id" => "00000000000",
                      "uuid" => "0000-1111-2222-3333",
                      "versionTag" => "0.0.0",
                    },
                  },
                ],
              },
            },
          }
        end
      end
    end
  end
end
