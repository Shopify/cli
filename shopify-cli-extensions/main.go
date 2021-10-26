package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/Shopify/shopify-cli-extensions/api"
	"github.com/Shopify/shopify-cli-extensions/build"
	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/create"
)

var ctx context.Context

//go:generate make update-version
const version = "v0.0.0"

func init() {
	ctx = context.Background()
}

func main() {
	cli := CLI{}
	cmd, args := os.Args[1], os.Args[2:]

	if len(args) > 0 {
		config, err := loadConfigFrom(args[0])
		if err != nil {
			panic(err)
		}
		cli.config = config
		args = args[1:]
	}

	switch cmd {
	case "build":
		cli.build(args...)
	case "create":
		cli.create(args...)
	case "serve":
		cli.serve(args...)
	case "version":
		fmt.Printf("%s\n", version)
	}
}

type CLI struct {
	config *core.Config
}

func (cli *CLI) build(args ...string) {
	var wg sync.WaitGroup
	build_chan := make(chan build.Result)

	errors := 0
	for _, e := range cli.config.Extensions {
		b := build.NewBuilder(e)

		wg.Add(1)
		go b.Build(ctx, func(result build.Result) {
			defer wg.Done()
			build_chan <- result

			if !result.Success {
				errors++
				log.Printf("[Build] Error: %s, Extension: %s", result.Error, result.UUID)
			} else {
				log.Printf("[Build] Success! Extension: %s", result.UUID)
			}
		})

		go cli.monitor(wg, build_chan, "Build", e)
	}

	wg.Wait()

	if errors > 0 {
		os.Exit(1)
	} else {
		os.Exit(0)
	}
}

func (cli *CLI) create(args ...string) {
	for _, extension := range cli.config.Extensions {
		err := create.NewExtensionProject(extension)
		if err != nil {
			panic(fmt.Errorf("failed to create a new extension: %w", err))
		}
	}
}

func (cli *CLI) serve(args ...string) {
	if cli.config.PublicUrl != "" {
		log.Printf("Shopify CLI Extensions Server is now available at %s", cli.config.PublicUrl)
	} else {
		log.Printf("Shopify CLI Extensions Server is now available at http://localhost:%d/", cli.config.Port)
	}

	api := api.New(cli.config, "/extensions/")

	var wg sync.WaitGroup

	develop_chan := make(chan build.Result)
	watch_chan := make(chan build.Result)

	for _, e := range cli.config.Extensions {
		b := build.NewBuilder(e)

		wg.Add(1)
		go b.Develop(ctx, func(result build.Result) {
			develop_chan <- result
		})

		go cli.monitorAndNotify(wg, develop_chan, "Develop", api, e)

		go b.Watch(ctx, func(result build.Result) {
			watch_chan <- result
		})

		go cli.monitorAndNotify(wg, watch_chan, "Watch", api, e)
	}

	addr := fmt.Sprintf(":%d", cli.config.Port)

	server := &http.Server{Addr: addr, Handler: api}

	onInterrupt(func() {
		api.Shutdown()
		server.Shutdown(ctx)
	})

	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		panic(err)
	}

	wg.Wait()
}

func (cli *CLI) monitorAndNotify(wg sync.WaitGroup, ch chan build.Result, action string, a *api.ExtensionsApi, e core.Extension) {
	defer wg.Done()

	for result := range ch {
		if result.Success {
			e.Development.Status = "success"
			log.Printf("[%s] event for extension: %s", action, result.UUID)
		} else {
			e.Development.Status = "error"
			log.Printf("[%s] error for extension %s, error: %s", action, result.UUID, result.Error.Error())
		}
		go a.Notify([]core.Extension{e})
	}
}

func (cli *CLI) monitor(wg sync.WaitGroup, ch chan build.Result, action string, e core.Extension) {
	defer wg.Done()

	for result := range ch {
		if result.Success {
			log.Printf("[%s] event for extension: %s", action, result.UUID)
		} else {
			log.Printf("[%s] error for extension %s, error: %s", action, result.UUID, result.Error.Error())
		}
	}
}

func loadConfigFrom(path string) (config *core.Config, err error) {
	var configSource io.ReadCloser

	if path == "-" {
		configSource = os.Stdin
	} else {
		configSource, err = os.Open(path)
		if err != nil {
			return
		}
		defer configSource.Close()
	}

	config, err = core.LoadConfig(configSource)
	if err != nil {
		panic(err)
	}

	return
}

func onInterrupt(handle func()) {
	interrupt := make(chan os.Signal)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-interrupt
		handle()
		os.Exit(0)
	}()
}
