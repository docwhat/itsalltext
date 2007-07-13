#
#  
#  It's All Text - Easy external editing of web forms.
#  Copyright (C) 2006-2007 Christian Höltje
#
#  This program is free software: you can redistribute it and/or modify
#  it under the terms of the GNU General Public License as published by
#  the Free Software Foundation, either version 3 of the License.
#
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
#
#  You should have received a copy of the GNU General Public License
#  along with this program.  If not, see <http://www.gnu.org/licenses/>.

## Options
# If you don't have jslint or jsmin, you can replace these with cat...
# but I strongly suggest you get jslint and jsmin working.
JSLINT     := jslint
#JSMIN      := jsmin
JSMIN      := cat
ZIP        := zip
PROJNICK   := itsalltext
PROJNAME   := "It's All Text!"
ICONFILE   := src/chrome/content/icon.png
VERSION    := 0.7.4


# NOTE: do not create files or directories in here that have
#       spaces or other special characters in their names!
SOURCES_CHROME:=$(shell find src/chrome -type f\
	   -not -regex '^\(\|.*/\)\(build\|lint\|tmpdir\|.svn\|CVS\|.DS_Store\).*\(\|/.*\)$$' \
       -not -regex '.*\.(xpi|orig|lint|log|xcf)' \
       -not -name '.*' \
       -not -name '*~' \
       -not -name '\#*' \
	   -print)
SOURCES_NONCHROME:=src/chrome.manifest src/gpl.txt src/install.rdf src/defaults/preferences/itsalltext.js
SOURCES:=$(SOURCES_CHROME) $(SOURCES_NONCHROME)
SOURCES_JS:=$(shell echo "$(SOURCES)" | xargs -n 1 echo | grep -E '\.js$$')
SOURCES_JS_LINT:=$(patsubst %.js, lint/%.js.lint, $(SOURCES_JS))
JARS:=chrome/content.jar chrome/en-US.jar

STAGE1_OUT:=$(patsubst src/%, stage1/%, $(SOURCES))
FINAL_OUT:=$(patsubst src/%, final/%, $(SOURCES_NONCHROME)) \
	       $(patsubst %, final/%, $(JARS))

XPI_FILE:=$(PROJNICK)-$(VERSION).xpi

ifeq ($(VERBOSE),1)
	Q :=
	QMAKE = $(MAKE)
else
	Q := @
	QMAKE = $(MAKE) -s
	ZIP := $(ZIP) -q
endif

.PHONY: default
default: lint narf final

.PHONY: all
all: lint narf docs final

## Release a new xpi
.PHONY: release
release: version_check $(XPI_FILE)
	$(Q)echo "Don't forget to bump the version number if $(VERSION) isn't right!"
	$(Q)echo "hg tag release-$(VERSION)"

## Show the version
.PHONY: version_check
version_check:
	$(Q)echo "Version is $(VERSION)"

## build an xpi
%.xpi: build
	$(Q)echo Creating $@ ...
	$(Q)(cd final && find -type f | $(ZIP) ../$@ -@)


#############
## Stage 1 ##
#############
.PHONY: stage1
stage1: .stage1-stamp

.stage1-stamp: Makefile narf lint $(STAGE1_OUT)
	$(Q)touch $@

stage1/%: src/%
	$(Q)mkdir -p $(dir $@)
	$(Q)cat $< | sed 's/999.@@VERSION@@/$(VERSION)/g' > $@

stage1/%.js: src/%.js
	$(Q)mkdir -p $(dir $@)
	$(Q)cat $< | sed 's/999.@@VERSION@@/$(VERSION)/g' | $(JSMIN) > $@


#################
## Final Stage ##
#################
.PHONY: final
final: .final-stamp

.final-stamp: Makefile $(FINAL_OUT)
	$(Q)touch $@

final/%: stage1/%
	$(Q)mkdir -p $(dir $@)
	$(Q)cp $< $@

final/chrome.manifest: stage1/chrome.manifest Makefile
	$(Q)mkdir -p $(dir $@)
	$(Q)perl -p -e 's!^(\s*content\s+itsalltext\s+)(chrome/)(\S+\s*)$$!$$1jar:$$2content.jar\!/$$3!;'  \
	-e 's!^(\s*locale\s+itsalltext\s+)(\S+)(\s+)(chrome/)(\S+\s*)$$!$$1$$2$$3jar:$$4$$2.jar\!/$$5!;' $< \
	> $@

final/chrome/content.jar: stage1
	$(Q)mkdir -p $(dir $@)
	$(Q)cd stage1/chrome && $(ZIP) -r ../../$@ content

final/chrome/en-US.jar: stage1
	$(Q)mkdir -p $(dir $@)
	$(Q)cd stage1/chrome && $(ZIP) -r ../../$@ locale/en-US

.PHONY: build
build: final

##
## Lint checks for possible problems.
.PHONY: lint
lint: $(SOURCES_JS_LINT)

$(SOURCES_JS_LINT): lint/%.js.lint: %.js
	$(Q)mkdir -p $(dir $@)
	$(Q)perl -p -e 's/^(\s*)const(\s+)/$$1var$$2/' $< > $@.pre
	$(Q)$(JSLINT) -p $@.pre > $@
	$(Q)if [ `wc -l $@|cut -d' ' -f1` -ne 1 ]; then\
	     touch --date='1972-01-01' "$@"; echo "lint: $@"; false; fi

.PHONY: showlint
showlint: 
	$(Q)$(QMAKE) -k lint || :
	$(Q)find ./lint -type f -name '*.lint' -print0 | xargs -0 cat | egrep -v '^jslint: No problems found in'

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
	--project-name "$(subst ", ', PROJNAME) - A Firefox Extension" \
	--logo $(ICONFILE) \
	--package-naming \
	--private \
	$^
	$(Q)touch "$@"

.PHONY: todo
todo: .todo
	$(Q)cat $<
.todo: $(SOURCES) Makefile
	$(Q)grep -hE '[@]todo' $^ | perl -p -e 's!^.*[@]todo\s*!!' | sort -n > "$@"


##
## Cleanup methods
.PHONY: clean
clean:
	$(Q)rm -rf build .todo stage1 final .*-stamp

.PHONY: realclean
realclean: clean
	$(Q)rm -rf $(XPI_FILE) docs lint

## @todo [5] [make] Do a proper build in another directory.
## @todo [5] [make] Minimize JavaScript.
## @todo [5] [make] Put contents into a .jar.
## @todo [7] Allow a web page to add an It's All Text! button.
## @todo [9] Thunderbird support.
## @todo [8] Seamonkey support. GUID: {92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}
## @todo [9] Option to disable yellow fade.
## @todo [9] Prevent double yellow fades.
## @todo [9] Option to choose yellow fade color.
