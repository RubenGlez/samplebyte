#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgPath = resolve(__dirname, '../package.json')

const bump = process.argv[2] ?? 'patch'
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: npm run tag [patch|minor|major]')
  process.exit(1)
}

const exec = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })

// Ensure working tree is clean
try {
  execSync('git diff --exit-code && git diff --cached --exit-code', { stdio: 'pipe' })
} catch {
  console.error('Working tree is dirty. Commit or stash your changes first.')
  process.exit(1)
}

// Bump version in package.json only, no git tag
exec(`npm version ${bump} --no-git-tag-version`)

const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'))
const tag = `v${version}`

// Commit the bump locally, then tag that commit
exec(`git add package.json`)
exec(`git commit -m "chore: bump version to ${tag}"`)
exec(`git tag ${tag}`)

// Push the tag (triggers CI) — tags are not subject to branch rules
exec(`git push origin ${tag}`)

console.log(`
Tag ${tag} pushed. CI will build and publish the release.

The version bump commit is local. Push it to main:
  - If you can push directly: git push
  - Otherwise open a PR from your current branch
`)
