package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
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
	if len(os.Args) < 3 {
		fmt.Println("You need to provide at least 2 arguments")
		os.Exit(1)
	}

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

func (cli *CLI) create(args ...string) {
	for _, extension := range cli.config.Extensions {
		err := create.NewExtensionProject(extension)
		if err != nil {
			panic(fmt.Errorf("failed to create a new extension: %w", err))
		}
	}
}

func (cli *CLI) serve(args ...string) {
	api := api.New(cli.config)

	for _, extension := range cli.config.Extensions {
		go build.Watch(extension, func(result build.Result) {
			if result.Success {
				fmt.Println(result)
			} else {
				fmt.Fprintln(os.Stderr, result)
			}

			api.Notify([]core.Extension{result.Extension})
		})

		go build.WatchLocalization(ctx, extension, func(result build.Result) {
			if result.Success {
				api.Notify([]core.Extension{result.Extension})
				fmt.Println(result)
			} else {
				fmt.Fprintln(os.Stderr, result)
			}
		})
	}

	addr := fmt.Sprintf(":%d", cli.config.Port)
	server := &http.Server{Addr: addr, Handler: api}

	onInterrupt(func() {
		api.Shutdown()
		server.Shutdown(ctx)
	})

	fmt.Printf("Shopify CLI Extensions Server is now available at %s\n", api.GetDevConsoleUrl())

	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		panic(err)
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
