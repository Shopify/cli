package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
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
	build_errors := 0

	for _, e := range cli.config.Extensions {
		b := build.NewBuilder(e.Development.BuildDir)

		log.Printf("Building %s, id: %s", e.Type, e.UUID)

		result := b.Build(ctx)

		if result.Success {
			log.Printf("Extension %s built successfully!", e.UUID)
		} else {
			build_errors += 1
			log.Printf("Extension %s failed to build: %s", e.UUID, result.Error.Error())
		}
	}

	switch {
	case build_errors == 1:
		log.Println("There was an error during build, please check your logs for more information.")
		os.Exit(1)
	case build_errors > 1:
		log.Printf("There were %d errors during build, please check your logs for more information.", build_errors)
		os.Exit(1)
	}
}

func (cli *CLI) create(args ...string) {
	extension := cli.config.Extensions[0]
	err := create.NewExtensionProject(extension)
	if err != nil {
		panic(fmt.Errorf("failed to create a new extension: %w", err))
	}
}

func (cli *CLI) serve(args ...string) {
	fmt.Println("Shopify CLI Extensions Server is now available at http://localhost:8000/")
	http.ListenAndServe(":8000", api.New(cli.config))
}
