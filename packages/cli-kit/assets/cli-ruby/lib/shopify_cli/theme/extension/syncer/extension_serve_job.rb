# frozen_string_literal: true
require "project_types/extension/loaders/project"
require "project_types/extension/loaders/specification_handler"
require "shopify_cli/partners_api"
require "shopify_cli/thread_pool/job"
require "shopify_cli/theme/notifier"

module ShopifyCLI
  module Theme
    module Extension
      class Syncer
        class ExtensionServeJob < ThreadPool::Job
          POLL_FREQUENCY = 0.5 # second
          PUSH_INTERVAL = 5 # seconds

          RESPONSE_FIELD = %w(data extensionUpdateDraft)
          VERSION_FIELD = "extensionVersion"
          USER_ERRORS_FIELD = "userErrors"
          ERROR_FILE_REGEX = /\[([^\]\[]*)\]/

          def initialize(ctx, syncer:, extension:, project:, specification_handler:, notify:)
            super(POLL_FREQUENCY)

            @ctx = ctx
            @extension = extension
            @project = project
            @specification_handler = specification_handler

            @notifier = ShopifyCLI::Theme::Notifier.new(ctx, path: notify)
            @syncer = syncer
            @syncer_mutex = Mutex.new

            @job_in_progress = false
            @job_in_progress_mutex = Mutex.new

            $stdout.sync = true
          end

          def perform!
            return unless @syncer.any_operation?
            return if job_in_progress?
            return if recently_synced? && !@syncer.any_blocking_operation?

            job_in_progress!

            print_items({}.freeze)

            files = @syncer.pending_files.map(&:relative_path)
            # Notify changes after the sync is complete
            @notifier.notify_updates(files)

            @syncer_mutex.synchronize do
              @syncer.pending_operations.clear
              @syncer.latest_sync = Time.now
            end

          ensure
            job_in_progress!(false)
          end

          private

          def job_in_progress!(in_progress = true)
            @job_in_progress_mutex.synchronize { @job_in_progress = in_progress }
          end

          def job_in_progress?
            @job_in_progress
          end

          def recently_synced?
            Time.now - @syncer.latest_sync < PUSH_INTERVAL
          end

          def success_message(project)
            "{{green:Pushed}} {{>}} {{blue:'#{project}'}} to a draft"
          end

          def error_message(project)
            "{{red:Error}}  {{>}} {{blue:'#{project}'}} could not be pushed:"
          end

          def print_file_success(file)
            @ctx.puts("{{blue:- #{file.relative_path}}}")
          end

          def print_file_error(file, err)
            @ctx.puts("{{red:- #{file.relative_path}}}")
            @ctx.puts("{{red:  - Cause: #{err}}}")
          end

          def erroneous_files(errors)
            files = {}
            errors.each do |e|
              path = e["message"][ERROR_FILE_REGEX, 1]
              file = @extension[path]
              files[file] = e["message"]
            end
            files
          end

          def print_items(erroneous_files)
            @syncer.pending_files.each do |file|
              err = erroneous_files.dig(file)
              if err
                print_file_error(file, err)
                erroneous_files.delete(file)
              else
                print_file_success(file)
              end
            end
            erroneous_files.each do |file, err|
              print_file_error(file, err)
            end
          end
        end
      end
    end
  end
end
