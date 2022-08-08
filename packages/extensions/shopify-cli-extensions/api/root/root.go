package root

import (
	"bytes"
	"embed"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/core/fsutils"
)

//go:embed templates/*
var templates embed.FS

func New(service *core.ExtensionService) *RootHandler {
	return &RootHandler{
		fsutils.NewFS(&templates, "templates"),
		&apiConfig{
			ApiRootUrl: service.ApiRootUrl,
			ApiRoot:    service.ApiRoot,
			Port:       service.Port,
			Store:      service.Store,
		},
	}
}

func (root *RootHandler) HandleHTMLRequest(rw http.ResponseWriter, r *http.Request, extension *core.Extension) {
	templateData := &extensionHtmlTemplateData{
		extension,
		root.apiConfig,
		path.Join(root.ApiRoot, extension.UUID),
	}

	if !strings.HasPrefix(root.ApiRootUrl, "https") {
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

	http.Redirect(rw, r, url, http.StatusTemporaryRedirect)
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

func (root *RootHandler) getRedirectUrl(r *http.Request, extension *core.Extension) (redirectUrl string, err error) {
	if root.Store == "" {
		err = fmt.Errorf("store is not defined")
		return
	}

	if extension.Surface == core.Checkout {
		if extension.Development.Resource.Url == "" {
			err = fmt.Errorf("resource url is not defined")
			return
		}

		rawUrl := url.URL{Scheme: "https", Host: root.Store, Path: extension.Development.Resource.Url, RawQuery: "dev=" + root.ApiRootUrl}
		redirectUrl = rawUrl.String()
		return
	}

	rawUrl := url.URL{Scheme: "https", Host: root.Store, Path: "admin/extensions-dev", RawQuery: "url=" + extension.Development.Root.Url}
	redirectUrl = rawUrl.String()
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
	ApiRoot    string
	Port       int
	Store      string
	ApiRootUrl string
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
