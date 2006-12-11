# NOTE: do not create files or directories in here that have
#       spaces or other special characters in their names!
SOURCES=$(shell find . \
	   -not -regex '^\(\|.*/\)\(tmpdir\|CVS\|\.hg\|\.DS_Store\).*\(\|/.*\)$$' \
       -not -name 'Makefile' \
       -not -name '*-report.txt' \
       -not -name '*.xpi' \
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

all: $(XPI_FILE) $(MOZILLA_XPI_FILE)
	$(Q)echo done

%.xpi: $(SOURCES)
	$(Q)echo Creating $@ ...
	$(Q)echo "$^" | perl -p -e 's/ /\n/g;' \
    | zip $@ -@

jslint-report.txt: $(SOURCES_JS)
	$(Q)for jsfile in $^; do jslint $${jsfile}; done > "$@" 2>&1

.PHONY: realclean
clean:
	$(Q)rm -f $(XPI_FILE)
