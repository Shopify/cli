.PHONY: update-version
update-version:
	git tag -l | sort | tail -n 1 | xargs -I {} ruby -i -pe 'sub(/^const version = .*$$/, "const version = \"{}\"")' -- main.go
