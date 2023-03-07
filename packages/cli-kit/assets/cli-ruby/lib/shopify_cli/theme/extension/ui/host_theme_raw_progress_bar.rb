
module ShopifyCLI
  module Theme
    module Extension
      module UI
        class HostThemeRawProgressBar
          GIT_CLONE_PROGRESS_SHARE = 0.2
          SYNC_PROGRESS_SHARE = 0.8

          def initialize(syncer, dir)
            @syncer = syncer
            @dir = dir
          end

          def progress(method, **args)
            @syncer.lock_io!
            old_sync = $stdout.sync
            $stdout.sync = true
            CLI::UI::ProgressPlain.progress(prefix: "Pushing theme...") do |bar|
              bar.tick(set_percent: 0)

              Git.public_send(:raw_clone, "https://github.com/Shopify/dawn.git", @dir) do |percent|
                bar.tick(set_percent: percent * GIT_CLONE_PROGRESS_SHARE)
              end

              @syncer.public_send(method, **args) do |left, total|
                next if total == 0
                bar.tick(set_percent: (1 - left.to_f / total) * SYNC_PROGRESS_SHARE + GIT_CLONE_PROGRESS_SHARE)
              end

              bar.tick(set_percent: 1)
            end
            $stdout.sync = old_sync
            @syncer.unlock_io!
          end
        end
      end
    end
  end
end
