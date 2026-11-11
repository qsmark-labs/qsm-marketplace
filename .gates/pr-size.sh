#!/usr/bin/env bash
# A pull request a person reads in one sitting: past 400 changed lines review stops finding
# defects (Cisco's review study). A file the base's .gitattributes marks linguist-generated is
# not read, so it does not count. Every attribute, -diff included, comes from the base, so a
# pull request cannot exempt itself; -z keeps an unusual file name unquoted.
# Usage: .gates/pr-size.sh <base> <head>, run by CI and by the pre-push hook.
set -euo pipefail
BASE=$1 HEAD=$2 LIMIT=400
numstat=$(mktemp)
trap 'rm -f "$numstat"' EXIT
# A file, not a process substitution, so a failed diff stops the script under -e.
git --attr-source="$BASE" diff --numstat -z --no-renames "$BASE...$HEAD" >"$numstat"
total=0
while IFS=$'\t' read -r -d '' added deleted file; do
  [[ $added == "-" ]] && continue
  [[ "$(git check-attr --source "$BASE" linguist-generated -- "$file" | sed 's/.*: //')" == "true" ]] && continue
  total=$((total + added + deleted))
  echo "$((added + deleted)) $file"
done <"$numstat"
echo "changed lines: $total of $LIMIT"
if [[ $total -gt $LIMIT ]]; then
  echo "::error::$total changed lines, past the $LIMIT a person reviews in one sitting: split the task."
  exit 1
fi
