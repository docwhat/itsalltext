#!/bin/sh

set -eu

for d in "$HOME/.mozilla/firefox/"*; do
  if [ -d "${d}" ]; then
    mkdir -p "${d}/extensions"
    echo '/vagrant/src/' > "${d}/extensions/itsalltext@docwhat.gerf.org"
  fi
done

exec firefox -jsconsole "$@"

# EOF
