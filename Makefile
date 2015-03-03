BIN := ./node_modules/.bin

VERSION := $(shell node -e "console.log(require('./package.json').version)")

.PHONY: usage

usage:
		@echo "Tag versioned release from package.json:"
		@echo "	$$ make release"

release:
	@git tag -m "$(VERSION)" v$(VERSION)
	@git push --tags
