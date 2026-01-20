#!/bin/bash
set -euo pipefail

VERSION=${1:-}
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.0.0"
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version format. Expected: 1.2.3"
  exit 1
fi

pnpm version "$VERSION" --no-git-tag-version
git add package.json pnpm-lock.yaml
git commit -m "chore: bump version to $VERSION"
git tag "v$VERSION"

echo "Version bumped to $VERSION"
echo "Run: git push && git push --tags"
