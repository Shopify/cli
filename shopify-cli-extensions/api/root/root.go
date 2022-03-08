package root

import (
	"bytes"
	"embed"
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/core/fsutils"
)

//go:embed templates/*
var templates embed.FS

func New(config *core.Config, apiRoot string) *RootHandler {
	return &RootHandler{
		fsutils.NewFS(&templates, "templates"),
		&apiConfig{
			ApiRoot: apiRoot,
			Port:    config.Port,
			Store:   config.Store,
			IntegrationContext: config.IntegrationContext,
		},
	}
}

func (root *RootHandler) HandleHTMLRequest(rw http.ResponseWriter, r *http.Request, extension *core.Extension) {
	templateData := &extensionHtmlTemplateData{
		extension,
		root.apiConfig,
		fmt.Sprintf("%s%s", root.ApiRoot, extension.UUID),
	}

	if !IsSecureRequest(r) {
		content, err := root.getTunnelError(templateData)
		if err != nil {
			root.handleError(rw, fmt.Errorf("failed to render index page: %v", err))
			return
		}
		rw.Write(content)
		return
	}

	if extension.Surface == core.PostPurchase {
		content, err := root.getIndexContent(templateData)
		if err != nil {
			root.handleError(rw, fmt.Errorf("failed to render index page: %v", err))
			return
		}
		rw.Write(content.Bytes())
		return
	}

	url, err := root.getRedirectUrl(r, extension)
	if err != nil {
		root.handleError(rw, fmt.Errorf("failed to construct redirect url: %v", err))
		return
	}

	http.Redirect(rw, r, url, http.StatusPermanentRedirect)
}

func IsSecureRequest(r *http.Request) bool {
	// TODO: Find a better way to handle this - looks like there's no easy way to get the request protocol
	re := regexp.MustCompile(`:([0-9])+$`)
	hasPort := re.MatchString(r.Host)
	return !strings.HasPrefix(r.Host, "localhost") && !hasPort

}

func (root *RootHandler) GetApiRootUrlFromRequest(r *http.Request) string {
	var protocol string
	if IsSecureRequest(r) {
		protocol = "https"
	} else {
		protocol = "http"
	}

	return fmt.Sprintf("%s://%s%s", protocol, r.Host, root.ApiRoot)
}

func (root *RootHandler) GetWebsocketUrlFromRequest(r *http.Request) string {
	var protocol string
	if IsSecureRequest(r) {
		protocol = "wss"
	} else {
		protocol = "ws"
	}

	return fmt.Sprintf("%s://%s%s", protocol, r.Host, root.ApiRoot)
}

func (root *RootHandler) getTunnelError(templateData *extensionHtmlTemplateData) (mergedContent []byte, err error) {
	content, err := root.getTunnelErrorContent(templateData)

	if err != nil {
		return
	}
	mergedContent = content.Bytes()
	return
}

func (root *RootHandler) getTunnelErrorContent(templateData *extensionHtmlTemplateData) (*bytes.Buffer, error) {
	specificTemplatePath := filepath.Join(templateData.Type, "tunnel-error.html.tpl")
	globalTemplatePath := filepath.Join("tunnel-error.html.tpl")

	if !root.FileExists(specificTemplatePath) {
		return root.MergeTemplateData(templateData, globalTemplatePath)
	}
	return root.MergeTemplateData(templateData, specificTemplatePath)
}

func (root *RootHandler) getIndexContent(templateData *extensionHtmlTemplateData) (*bytes.Buffer, error) {
	specificTemplatePath := filepath.Join(templateData.Type, "index.html.tpl")
	return root.MergeTemplateData(templateData, specificTemplatePath)
}

func (root *RootHandler) getRedirectUrl(r *http.Request, extension *core.Extension) (url string, err error) {
	if root.Store == "" {
		err = fmt.Errorf("store is not defined")
		return
	}

	if extension.Surface == core.Checkout {
		if extension.Development.Resource.Url == "" {
			err = fmt.Errorf("resource url is not defined")
			return
		}

		url = fmt.Sprintf("https://%s/%s?dev=%s", root.Store, extension.Development.Resource.Url, root.GetApiRootUrlFromRequest(r))
		return
	}

	url = fmt.Sprintf("https://%s/admin/extensions-dev?url=%s", root.Store, extension.Development.Root.Url)
	return
}

func (root *RootHandler) getErrorContent(err error) (*bytes.Buffer, error) {
	return root.MergeTemplateData(errorsTemplateData{err.Error()}, filepath.Join("error.html.tpl"))
}

func (root *RootHandler) handleError(rw http.ResponseWriter, errorMessage error) {
	content, err := root.getErrorContent(errorMessage)
	if err != nil {
		rw.Write([]byte(fmt.Sprintf("cannot return error page: %v", err)))
		return
	}
	rw.Write(content.Bytes())
}

type apiConfig struct {
	ApiRoot string
	Port    int
	Store   string
	core.IntegrationContext
}

type RootHandler struct {
	*fsutils.FS
	*apiConfig
}

type extensionHtmlTemplateData struct {
	*core.Extension
	*apiConfig
	RelativePath string
}

type errorsTemplateData struct {
	Error string
}
