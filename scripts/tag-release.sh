#!/usr/bin/env bash
set -e

TYPE=${1:-patch}

case "$TYPE" in
  patch|minor|major) ;;
  *)
    echo "Usage: $0 [patch|minor|major]"
    exit 1
    ;;
esac

LATEST=$(git tag --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
if [ -z "$LATEST" ]; then
  PKG_VERSION=$(node -e "console.log(require('./package.json').version)")
  LATEST="v${PKG_VERSION}"
fi

VERSION=${LATEST#v}
MAJOR=$(echo "$VERSION" | cut -d. -f1)
MINOR=$(echo "$VERSION" | cut -d. -f2)
PATCH=$(echo "$VERSION" | cut -d. -f3)

case "$TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEW_TAG="v${MAJOR}.${MINOR}.${PATCH}"
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

echo "$LATEST → $NEW_TAG"
npm version "$NEW_VERSION" --no-git-tag-version
git add package.json
git commit -m "chore: bump version to $NEW_TAG"
git tag "$NEW_TAG"
git push origin HEAD "$NEW_TAG"
