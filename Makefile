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

# NOTE: do not create files or directories in here that have
#       spaces or other special characters in their names!
SOURCES=$(shell find . \
	   -not -regex '^\(\|.*/\)\(tmpdir\|CVS\|\.hg\|\.DS_Store\|docs\).*\(\|/.*\)$$' \
       -not -name 'Makefile' \
       -not -name '*\.log' \
       -not -name '*\.xpi' \
       -not -name '.*' \
       -not -name '*~' \
	   -print)
#VERSION=$(shell grep '<em:version>' install.rdf| perl -p -e 's!.*<em:version>\s*([^<]*)\s*</em:version>.*!$$1!;')
VERSION=$(shell grep 'em:version=' install.rdf| perl -p -e 's!.*em:version\s*=\s*"([^"]*)".*!$$1!;')
SOURCES_JS=$(shell echo "$(SOURCES)" | xargs -n 1 echo | grep -E '\.js$$')

XPI_FILE=../itsalltext-$(VERSION).xpi

ifeq ($(VERBOSE),1)
	Q =
else
	Q = @
endif

all: jslint docs
	$(Q)echo done

.PHONY: release
release: jslint version_check $(XPI_FILE)
	$(Q)echo "Don't forget to:"
	$(Q)echo " * update changelog.txt"
	$(Q)echo " * bump the version number"

.PHONY: version_check
version_check:
	$(Q)echo "Version is $(VERSION)"

%.xpi: $(SOURCES)
	$(Q)echo Creating $@ ...
	$(Q)echo "$^" | perl -p -e 's/ /\n/g;' \
    | zip $@ -@

docs: $(SOURCES_JS)
	$(Q)echo Creating $@ ...
	$(Q)jsdoc --directory "$@" \
	--project-name "It's All Text" \
	--logo chrome/content/icon.png \
	--package-naming \
	--private \
	$(SOURCES_JS)

.PHONY: jslint
jslint: jslint.log

jslint.log: $(SOURCES_JS)
	$(Q)echo Linting source ...
	$(Q)for jsfile in $^; do echo "jslint: $${jsfile}" ; jslint $${jsfile}; done > "$@" 2>&1
	$(Q)if [ `egrep -v '^jslint: ' "$@" | wc -l` -eq 0 ]; \
	 then echo "  ... pass" ; \
	 else touch --date='1972-01-01' "$@"; \
	   echo "  ... there were $$(egrep '^Lint at line ' $@ | wc -l) errors."; \
	 fi

.PHONY: todo
todo:
	$(Q)echo "ToDo List:"
	$(Q)grep -h '@todo' $(SOURCES) | perl -p -e 's!^[ /*\t]+\@todo:?\s*! * !i;'

.PHONY: narf
narf:
	$(Q)grep -nri 'narf' [a-z0-9]*

.PHONY: clean
clean:
	$(Q)rm -rf $(XPI_FILE) *.log

.PHONY: realclean
realclean: clean
	$(Q)rm -rf ../itsalltext*.xpi docs
