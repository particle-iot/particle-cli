#!/usr/bin/env bash
set -e

node_script="\
	const semver = require('semver');\
	console.log(semver.lt(process.versions.node, '8.0.0') ? 1 : 0);\
"

is_unsupported=$(node --eval "${node_script}")

if [ ${is_unsupported} -gt 0 ]; then
	echo ":::: NODE 8 OR ABOVE IS REQUIRED"
	exit 0;
fi

exec "$@"
