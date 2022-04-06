package create

import "github.com/Shopify/shopify-cli-extensions/core"

func LookupRule(ext core.Extension, source *SourceFileReference, target *TargetFileReference) Rule {
	if rule := rules[source.Path()]; rule != nil {
		return rule
	} else {
		return defaultRule
	}
}

var rules = Rules{
	"src/index.tpl": func(ext core.Extension, source *SourceFileReference, target *TargetFileReference) *TargetFileReference {
		if ext.Development.UsesTypeScript() {
			if ext.Development.UsesReact() {
				return target.Rename("index.tsx")
			} else {
				return target.Rename("index.ts")
			}
		} else {
			return target.Rename("index.js")
		}
	},
}

var defaultRule Rule = func(ext core.Extension, source *SourceFileReference, target *TargetFileReference) *TargetFileReference {
	return target
}

type Rules map[string]Rule

type Rule func(ext core.Extension, source *SourceFileReference, target *TargetFileReference) *TargetFileReference
