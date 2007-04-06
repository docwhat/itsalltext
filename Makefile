#
#  It's All Text - Easy external editing of web forms.
#  Copyright (C) 2006 Christian Höltje
#  
#  This program is free software; you can redistribute it and/or modify
#  it under the terms of the GNU General Public License as published by
#  the Free Software Foundation; either version 2 of the License or
#  any later version.
#  
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
#  
#  You should have received a copy of the GNU General Public License along
#  with this program; if not, write to the Free Software Foundation, Inc.,
#  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
#

## Options
# If you don't have jslint or jsmin, you can replace these with cat...
# but I strongly suggest you get jslint and jsmin working.
JSLINT     := jslint
#JSMIN      := jsmin
JSMIN      := cat
PROJNICK   := itsalltext
PROJNAME   := "It's All Text!"
ICONFILE   := src/chrome/content/icon.png
VERSION    := 0.6.5

# NOTE: do not create files or directories in here that have
#       spaces or other special characters in their names!
SOURCES:=$(shell find src/ -type f\
	   -not -regex '^\(\|.*/\)\(build\|lint\|tmpdir\|.svn\|CVS\|.DS_Store\).*\(\|/.*\)$$' \
       -not -name 'Makefile' \
       -not -name '*-report.txt' \
       -not -name '*.xpi' \
       -not -name '*.log' \
       -not -name '*.lint' \
       -not -name '*.xcf' \
       -not -name '.*' \
       -not -name '*~' \
       -not -name '\#*' \
	   -print)
SOURCES_JS:=$(shell echo "$(SOURCES)" | xargs -n 1 echo | grep -E '\.js$$')
SOURCES_JS_LINT:=$(patsubst %.js, lint/%.js.lint, $(SOURCES_JS))
OUTPUT:=$(patsubst src/%, build/%, $(SOURCES))

XPI_FILE:=$(PROJNICK)-$(VERSION).xpi

ifeq ($(VERBOSE),1)
	Q :=
	QMAKE = $(MAKE)
else
	Q := @
	QMAKE = $(MAKE) -s
endif

all: lint
	$(Q)echo done

## Release a new xpi
.PHONY: release
release: version_check $(XPI_FILE)
	$(Q)echo "Don't forget to (see the README.txt):"
	$(Q)echo " * bump the version number"
	$(Q)echo " * commit the tag"

## Show the version
.PHONY: version_check
version_check:
	$(Q)echo "Version is $(VERSION)"

## build an xpi
%.xpi: build
	$(Q)echo Creating $@ ...
	$(Q)(cd build && find -type f | zip ../$@ -@)

##
## Build proccess. Puts the files we want in the extension into build/
.PHONY: build
build: narf lint .build-stamp

.build-stamp: Makefile $(OUTPUT)
	$(Q)touch $@

$(filter-out %.rdf %.dtd %.xhtml %.js, $(OUTPUT)): build/%: src/%
	$(Q)mkdir -p $(dir $@)
	$(Q)cp $< $@

$(filter %.rdf %.dtd %.xhtml, $(OUTPUT)): build/%: src/%
	$(Q)mkdir -p $(dir $@)
	$(Q)cat $< | sed 's/@@VERSION@@/$(VERSION)/g' > $@

$(filter %.js, $(OUTPUT)): build/%.js: src/%.js
	$(Q)mkdir -p $(dir $@)
	$(Q)cat $< | sed 's/@@VERSION@@/$(VERSION)/g' | $(JSMIN) > $@


##
## Lint checks for possible problems.
.PHONY: lint
lint: $(SOURCES_JS_LINT)

$(SOURCES_JS_LINT): lint/%.js.lint: %.js
	$(Q)mkdir -p $(dir $@)
	$(Q)$(JSLINT) -p $< > $@
	$(Q)if [ `wc -l $@|cut -d' ' -f1` -ne 1 ]; then\
	     touch --date='1972-01-01' "$@"; echo "lint: $@"; false; fi

.PHONY: showlint
showlint: 
	$(Q)$(QMAKE) lint || find ./lint -type f -print0 | xargs -0 cat | egrep -v '^jslint: No problems found in' || :

##
## Narf is a magick keyword that should stop builds from working
## Useful as a todo marker.
.PHONY: narf
narf: .narf-stamp

.narf-stamp:
	$(Q)grep -nri 'narf' [a-z0-9]* ; test $$? = 1
	$(Q)touch $@

##
## Documentation
.PHONY: docs
docs: docs/.stamp
docs/.stamp: $(SOURCES_JS)
	$(Q)echo Creating docs ...
	$(Q)jsdoc --directory docs \
	--project-name "$(PROJNAME) - A Firefox Extension" \
	--logo $(ICONFILE) \
	--package-naming \
	--private \
	$^
	$(Q)touch "$@"


##
## Cleanup methods
.PHONY: clean
clean:
	$(Q)rm -rf lint build docs

.PHONY: realclean
realclean: clean
	$(Q)rm -f $(XPI_FILE)

## @todo [5] [make] Do a proper build in another directory.
## @todo [5] [make] Minimize JavaScript.
## @todo [5] [make] Put contents into a .jar.
