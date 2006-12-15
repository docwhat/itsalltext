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
VERSION=$(shell grep '<em:version>' install.rdf| perl -p -e 's!.*<em:version>\s*([^<]*)\s*</em:version>.*!$$1!;')
SOURCES_JS=$(shell echo "$(SOURCES)" | xargs -n 1 echo | grep -E '\.js$$')

XPI_FILE=../itsalltext.xpi

ifeq ($(VERBOSE),1)
	Q =
else
	Q = @
endif

all: jslint docs xpi
	$(Q)echo done

.PHONY: xpi
xpi: jslint $(XPI_FILE)

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

.PHONY: clean
clean:
	$(Q)rm -rf $(XPI_FILE) *.log docs
