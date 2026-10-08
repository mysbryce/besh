import { readFileSync } from 'node:fs'

type Version = {
  parts: [number, number, number]
  stage: number
  candidate: number
}

function version(value: unknown): Version {
  if (typeof value !== 'string') throw new Error('Version must be text')
  const match = value.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.(0|[1-9]\d*))?$/,
  )
  if (!match)
    throw new Error('Use x.y.z with optional -alpha.N, -beta.N or -rc.N')

  const parts = match.slice(1, 4).map(Number) as Version['parts']
  const candidate = Number(match[5] ?? 0)
  if (![...parts, candidate].every(Number.isSafeInteger))
    throw new Error('Version numbers exceed the supported range')
  if (parts[0] !== 0)
    throw new Error(
      '1.0.0 and higher require explicit maintainer approval and a reviewed policy change',
    )

  return {
    parts,
    stage: match[4] ? ['alpha', 'beta', 'rc'].indexOf(match[4]) : 3,
    candidate,
  }
}

function git(...args: string[]) {
  const result = Bun.spawnSync(
    [
      'git',
      '-c',
      `safe.directory=${process.cwd().replaceAll('\\', '/')}`,
      ...args,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  if (result.exitCode !== 0)
    throw new Error('Could not read release Git metadata')
  return result.stdout.toString().trim()
}

function sha(value: string) {
  if (!/^[a-f0-9]{40}$/i.test(value))
    throw new Error('Release base and commit must be full Git commit hashes')
  return value
}

function newer(current: Version, previous: Version) {
  const left = [...current.parts, current.stage, current.candidate]
  const right = [...previous.parts, previous.stage, previous.candidate]
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return left[index] > right[index]
  }
  return false
}

function changelogEntry(changelog: string, value: string) {
  const entries = [
    ...changelog.matchAll(/^## (\S+) — (\d{4}-\d{2}-\d{2})\s*$/gm),
  ]
  const entry = entries[0]
  if (!entry || entry[1] !== value)
    throw new Error('Newest dated changelog entry must match package.json')
  const date = new Date(`${entry[2]}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== entry[2]
  )
    throw new Error('Changelog entry needs a valid calendar date')
  const start = entry.index! + entry[0].length
  const end = changelog.indexOf('\n## ', start)
  const notes = changelog.slice(start, end < 0 ? undefined : end)
  if (
    !/^### (Added|Changed|Fixed|Security|Removed|Deprecated)\s*$/m.test(
      notes,
    ) ||
    !/^- \S/m.test(notes)
  )
    throw new Error(
      'Changelog entry needs a change category and at least one note',
    )
}

function check() {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
  const current = version(manifest.version)
  const changelog = readFileSync('CHANGELOG.md', 'utf8')
  changelogEntry(changelog, manifest.version)

  const expected = process.env.BESH_RELEASE_VERSION
  if (expected && expected !== manifest.version)
    throw new Error('Requested release version does not match package.json')

  const base = process.env.BESH_RELEASE_BASE_SHA
  if (base && !/^0{40}$/.test(base)) {
    const previousManifest = JSON.parse(
      git('show', `${sha(base)}:package.json`),
    )
    const previous = version(previousManifest.version)
    if (!newer(current, previous))
      throw new Error('Completed delivery must increase package.json version')
    const previousChangelog = git('show', `${sha(base)}:CHANGELOG.md`)
    if (previousChangelog === changelog.trim())
      throw new Error('Version bump must include a changelog update')
    const commit = process.env.BESH_RELEASE_COMMIT_SHA
    const subject = git(
      'show',
      '-s',
      '--format=%s',
      commit ? sha(commit) : 'HEAD',
    )
    if (
      !/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_./-]+\))?!?: \S.+$/.test(
        subject,
      )
    )
      throw new Error('Delivery commit needs a Conventional Commit subject')
    if (subject.startsWith('feat') && current.parts[1] === previous.parts[1])
      throw new Error('New feature delivery must increase the minor version')
  }

  console.log(`Release policy passed: ${manifest.version}`)
}

try {
  check()
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Release policy failed',
  )
  process.exitCode = 1
}
