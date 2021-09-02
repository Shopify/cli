package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/Shopify/shopify-cli-extensions/api"
	"github.com/Shopify/shopify-cli-extensions/build"
	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/create"
)

var ctx context.Context

func init() {
	ctx = context.Background()
}

func main() {
	config, err := core.LoadConfig(os.Stdin)
	if err != nil {
		panic(err)
	}

	cmd, args := os.Args[1], os.Args[2:]
	cli := CLI{config}

	switch cmd {
	case "build":
		cli.build(args...)
	case "create":
		cli.create(args...)
	case "serve":
		cli.serve(args...)
	}
}

type CLI struct {
	config *core.Config
}

func (cli *CLI) build(args ...string) {
	api := api.New(cli.config, ctx)
	build_workers := len(cli.config.Extensions)
	build_chan := make(chan build.Result)

	for _, e := range cli.config.Extensions {
		b := build.NewBuilder(e)
		log.Printf("Building %s, id: %s", e.Type, e.UUID)

		go b.Build(ctx, func(result build.Result) {
			build_chan <- result
		})

		go cli.monitor(build_workers, build_chan, "Build", api, e)
	}

	<-build_chan
}

func (cli *CLI) create(args ...string) {
	extension := cli.config.Extensions[0]
	err := create.NewExtensionProject(extension)
	if err != nil {
		panic(fmt.Errorf("failed to create a new extension: %w", err))
	}
}

func (cli *CLI) serve(args ...string) {
	log.Printf("Shopify CLI Extensions Server is now available at http://localhost:%d/", cli.config.Port)
	api := api.New(cli.config, ctx)

	develop_workers := len(cli.config.Extensions)
	watch_workers := len(cli.config.Extensions)

	develop_chan := make(chan build.Result)
	watch_chan := make(chan build.Result)

	for _, e := range cli.config.Extensions {
		b := build.NewBuilder(e)

		go b.Develop(ctx, func(result build.Result) {
			develop_chan <- result
		})

		go cli.monitor(develop_workers, develop_chan, "Develop", api, e)

		go b.Watch(ctx, func(result build.Result) {
			watch_chan <- result
		})

		go cli.monitor(watch_workers, watch_chan, "Watch", api, e)
	}

	go api.Start(ctx)

	<-develop_chan
	<-watch_chan
}

func (cli *CLI) monitor(active_workers int, ch chan build.Result, action string, a *api.ExtensionsApi, e core.Extension) {
	for result := range ch {
		active_workers--

		if result.Success {
			log.Printf("[%s] event for extension: %s", action, result.UUID)
			go a.Notify(api.StatusUpdate{Type: "Success", Extensions: []core.Extension{e}})
		} else {
			log.Printf("[%s] error for extension %s, error: %s", action, result.UUID, result.Error.Error())
			go a.Notify(api.StatusUpdate{Type: "Success", Extensions: []core.Extension{e}})
		}
	}

	if active_workers == 0 {
		close(ch)
	}
}
