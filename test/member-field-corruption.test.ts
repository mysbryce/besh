import { expect, test } from 'bun:test'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { Database } from 'bun:sqlite'
import { createApp } from '../src/app'
import type { DataRow, DataSource } from '../src/data/sources'
import type {
  DatabaseConnection,
  DatabasePreview,
} from '../src/databases/model'
import type { Member, RuntimeKey, WorkspaceRole } from '../src/workspace/store'
import type {
  DatabaseMemberFieldProfile,
  MemberFieldProfileSummary,
  SourceMemberFieldProfile,
} from '../src/workspace/member-field-model'

type Server = ReturnType<typeof createApp>
type RequestAt = (
  path: string,
  method?: string,
  body?: unknown,
  token?: string,
) => Promise<Response>
type Identified = { id: string }
type IssuedKey = RuntimeKey & { token: string }
type CreatedMember = Member & { token: string }
type AuditEvent = { action: string; resource: string } & Record<string, unknown>
type SourcePreview = DataSource & { rows: DataRow[] }

test('unknown selected member keys in a detached public backup fail closed without changing the pristine workspace', async () => {
  const prefix = 'besh-member-field-corruption-'
  const directory = mkdtempSync(join(tmpdir(), prefix))
  const owner = randomUUID() + randomUUID()
  const servers: Server[] = []
  let pristinePath: string | undefined
  let pristineHash: string | undefined

  function checkedFile(name: string) {
    const target = resolve(directory, name)
    if (
      resolve(directory, '..') !== resolve(tmpdir()) ||
      !basename(directory).startsWith(prefix) ||
      resolve(target, '..') !== resolve(directory) ||
      !target.startsWith(resolve(directory) + sep)
    )
      throw new Error(
        'Detached fixtures must stay inside their OS temporary directory',
      )
    return target
  }

  function workspace(path: string, label: string): RequestAt {
    const server = createApp({
      databasePath: path,
      backupDir: join(directory, label + '-backups'),
      runtimeCodeDir: join(directory, label + '-runtime'),
      adminToken: owner,
    })
    servers.push(server)
    return (route, method = 'GET', body, token = owner) =>
      server.app.handle(
        new Request('http://localhost' + route, {
          method,
          headers: {
            authorization: 'Bearer ' + token,
            ...(body === undefined || body instanceof FormData
              ? {}
              : { 'content-type': 'application/json' }),
          },
          body:
            body instanceof FormData
              ? body
              : body === undefined
                ? undefined
                : JSON.stringify(body),
        }),
      )
  }

  async function call<T>(
    request: RequestAt,
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
  ): Promise<T> {
    const response = await request(path, method, body, token)
    if (response.status !== 200) {
      const failure = (await response.json()) as { error?: string }
      throw new Error(
        `${method} ${path}: ${response.status} ${failure.error ?? 'Request failed'}`,
      )
    }
    expect(response.status).toBe(200)
    return (await response.json()) as T
  }

  function sha256(path: string) {
    return createHash('sha256').update(readFileSync(path)).digest('hex')
  }

  try {
    const original = workspace(checkedFile('original.sqlite'), 'original')
    const sourceUpload = new FormData()
    sourceUpload.set('name', 'Backup member source')
    sourceUpload.set(
      'file',
      new File(
        ['tenant,name,salary\nA,Ada,1200\nB,Grace,2400\n'],
        'people.csv',
      ),
    )
    const source = await call<DataSource>(
      original,
      '/api/data-sources/import',
      'POST',
      sourceUpload,
    )
    const product = new Database(':memory:')
    let productBytes: Uint8Array<ArrayBuffer>
    try {
      product.run('CREATE TABLE people (tenant TEXT, name TEXT)')
      product.query('INSERT INTO people VALUES (?, ?)').run('A', 'Copy Ada')
      product.query('INSERT INTO people VALUES (?, ?)').run('B', 'Copy Grace')
      productBytes = new Uint8Array(product.serialize())
    } finally {
      product.close()
    }
    const copyUpload = new FormData()
    copyUpload.set('name', 'Independent protected copy')
    copyUpload.set('file', new File([productBytes!.buffer], 'people.sqlite'))
    const copy = await call<DatabaseConnection>(
      original,
      '/api/database-connections',
      'POST',
      copyUpload,
    )
    const sourceFlow = await call<Identified>(
      original,
      `/api/data-sources/${source.id}/api`,
      'POST',
      {
        name: 'Retained member source names',
        path: '/corrupt-member-source',
        protocol: 'rest',
        columns: ['name'],
        limit: 10,
      },
    )
    const copyFlow = await call<Identified>(
      original,
      `/api/database-connections/${copy.id}/api`,
      'POST',
      {
        version: 1,
        name: 'Independent member copy names',
        path: '/independent-member-copy',
        protocol: 'rest',
        table: 'people',
        columns: ['name'],
        limit: 10,
      },
    )
    const tenant = await call<Identified>(original, '/api/tenants', 'POST', {
      label: 'Approved company',
      value: 'A',
    })
    await call<unknown>(
      original,
      `/api/data-sources/${source.id}/row-policy`,
      'PUT',
      { mode: 'tenant', column: 'tenant', version: 1, resourceVersion: 1 },
    )
    await call<unknown>(
      original,
      `/api/database-connections/${copy.id}/row-policy`,
      'PUT',
      {
        mode: 'tenant',
        version: 1,
        resourceVersion: 1,
        tables: [{ table: 'people', column: 'tenant' }],
      },
    )
    for (const flow of [sourceFlow, copyFlow])
      await call<unknown>(original, `/api/flows/${flow.id}/publish`, 'POST', {
        revision: 1,
      })
    const role = await call<WorkspaceRole>(original, '/api/roles', 'POST', {
      name: 'Backup original credential manager',
      permissions: ['runtime-keys.manage'],
    })
    const member = await call<CreatedMember>(original, '/api/members', 'POST', {
      name: 'Original backup issuer',
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: [sourceFlow.id, copyFlow.id],
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [copy.id],
          authConnections: [],
        },
      },
    })
    const profilePath = `/api/data-sources/${source.id}/member-fields/${member.id}`
    const summaryPath = `/api/data-sources/${source.id}/member-fields`
    const current = await call<SourceMemberFieldProfile>(original, profilePath)
    const saved = await call<SourceMemberFieldProfile>(
      original,
      profilePath,
      'PUT',
      {
        version: current.version,
        resourceVersion: current.resourceVersion,
        memberAccessVersion: current.member.accessVersion,
        tenantAssignmentVersion: current.member.tenantAssignment.version,
        tenantVersion: current.tenant!.version,
        roleId: current.member.roleId,
        roleVersion: current.member.roleVersion,
        fields: { mode: 'selected', columns: ['name'] },
      },
    )
    expect(saved.profile).toEqual({ mode: 'selected', columns: ['name'] })
    const issue = (flow: Identified) =>
      call<IssuedKey>(
        original,
        '/api/runtime-keys',
        'POST',
        {
          name: 'Original pinned backup caller',
          flowId: flow.id,
          permissions: ['rest'],
          releaseRevision: 1,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
        member.token,
      )
    const sourceKey = await issue(sourceFlow)
    const copyKey = await issue(copyFlow)
    for (const key of [sourceKey, copyKey]) {
      expect(key.tenantId).toBe(tenant.id)
      expect(key.releaseRevision).toBe(1)
      expect(key.issuerBinding).toEqual({
        memberId: member.id,
        action: 'runtime-keys.manage',
      })
    }
    expect(
      await call<DataRow[]>(
        original,
        '/run/corrupt-member-source',
        'GET',
        undefined,
        sourceKey.token,
      ),
    ).toEqual([{ name: 'Ada' }])
    expect(
      await call<DataRow[]>(
        original,
        '/run/independent-member-copy',
        'GET',
        undefined,
        copyKey.token,
      ),
    ).toEqual([{ name: 'Copy Ada' }])
    const artifactPath = `/api/flows/${sourceFlow.id}/backend-code?revision=1`
    const artifact = await call<unknown>(original, artifactPath)
    const originalSummary = await call<MemberFieldProfileSummary>(
      original,
      summaryPath,
    )
    const originalPreview = await call<SourcePreview>(
      original,
      `/api/data-sources/${source.id}`,
    )
    const receipt = await call<{ id: string; bytes: number }>(
      original,
      '/api/backups',
      'POST',
    )
    const downloaded = await original(`/api/backups/${receipt.id}`)
    expect(downloaded.status).toBe(200)
    const archive = new Uint8Array(await downloaded.arrayBuffer())
    expect(archive.byteLength).toBe(receipt.bytes)
    pristinePath = checkedFile('pristine-downloaded.sqlite')
    writeFileSync(pristinePath, archive)
    pristineHash = sha256(pristinePath)
    const originalAudit = await call<AuditEvent[]>(original, '/api/audit')

    const detachedPath = checkedFile(
      'detached-unknown-source-member-key.sqlite',
    )
    writeFileSync(detachedPath, archive)
    expect(sha256(detachedPath)).toBe(pristineHash)
    // Mutate only this closed, detached copy of a publicly downloaded backup.
    const detached = new Database(detachedPath)
    try {
      const changed = detached
        .query(
          'UPDATE source_member_field_profiles SET columns = ? WHERE resource_id = ? AND member_id = ?',
        )
        .run(JSON.stringify(['unknown_field']), source.id, member.id)
      expect(changed.changes).toBe(1)
    } finally {
      detached.close()
    }
    expect(sha256(pristinePath)).toBe(pristineHash)
    const restored = workspace(detachedPath, 'detached')
    const auditBeforeDenied = await call<AuditEvent[]>(restored, '/api/audit')
    const deniedRequests: [string, string][] = [
      [summaryPath, owner],
      [profilePath, owner],
      ['/run/corrupt-member-source', sourceKey.token],
    ]
    for (const [path, token] of deniedRequests) {
      const denied = await restored(path, 'GET', undefined, token)
      expect(denied.status).toBe(503)
      const body: unknown = await denied.json()
      expect(body).toEqual({ error: 'Member field profile is unavailable' })
      expect(JSON.stringify(body)).not.toContain('Ada')
      expect(JSON.stringify(body)).not.toContain('Grace')
    }
    expect(await call<AuditEvent[]>(restored, '/api/audit')).toEqual(
      auditBeforeDenied,
    )
    expect(await call<unknown>(restored, artifactPath)).toEqual(artifact)
    expect(
      await call<SourcePreview>(restored, `/api/data-sources/${source.id}`),
    ).toEqual(originalPreview)
    expect(
      await call<DataRow[]>(
        restored,
        '/run/independent-member-copy',
        'GET',
        undefined,
        copyKey.token,
      ),
    ).toEqual([{ name: 'Copy Ada' }])

    expect(await call<SourceMemberFieldProfile>(original, profilePath)).toEqual(
      saved,
    )
    expect(
      await call<MemberFieldProfileSummary>(original, summaryPath),
    ).toEqual(originalSummary)
    expect(
      await call<SourcePreview>(original, `/api/data-sources/${source.id}`),
    ).toEqual(originalPreview)
    expect(await call<unknown>(original, artifactPath)).toEqual(artifact)
    expect(await call<AuditEvent[]>(original, '/api/audit')).toEqual(
      originalAudit,
    )
    expect(sha256(pristinePath)).toBe(pristineHash)
  } finally {
    try {
      for (const server of servers.reverse()) await server.close()
      if (pristinePath && pristineHash)
        expect(sha256(pristinePath)).toBe(pristineHash)
    } finally {
      const target = resolve(directory)
      if (
        resolve(target, '..') !== resolve(tmpdir()) ||
        !target.startsWith(resolve(tmpdir()) + sep) ||
        !basename(target).startsWith(prefix)
      )
        throw new Error(
          'Fixture cleanup must stay inside its OS temporary directory',
        )
      rmSync(target, { recursive: true, force: true, maxRetries: 5 })
    }
  }
})

test('unknown selected copy member keys in a detached public backup leave independent source reads and raw owner copy access intact', async () => {
  const prefix = 'besh-copy-member-field-corruption-'
  const directory = mkdtempSync(join(tmpdir(), prefix))
  const owner = randomUUID() + randomUUID()
  const servers: Server[] = []
  let pristinePath: string | undefined
  let pristineHash: string | undefined

  function checkedFile(name: string) {
    const target = resolve(directory, name)
    if (
      resolve(directory, '..') !== resolve(tmpdir()) ||
      !basename(directory).startsWith(prefix) ||
      resolve(target, '..') !== resolve(directory) ||
      !target.startsWith(resolve(directory) + sep)
    )
      throw new Error(
        'Detached fixtures must stay inside their OS temporary directory',
      )
    return target
  }

  function workspace(path: string, label: string): RequestAt {
    const server = createApp({
      databasePath: path,
      backupDir: join(directory, label + '-backups'),
      runtimeCodeDir: join(directory, label + '-runtime'),
      adminToken: owner,
    })
    servers.push(server)
    return (route, method = 'GET', body, token = owner) =>
      server.app.handle(
        new Request('http://localhost' + route, {
          method,
          headers: {
            authorization: 'Bearer ' + token,
            ...(body === undefined || body instanceof FormData
              ? {}
              : { 'content-type': 'application/json' }),
          },
          body:
            body instanceof FormData
              ? body
              : body === undefined
                ? undefined
                : JSON.stringify(body),
        }),
      )
  }

  async function call<T>(
    request: RequestAt,
    path: string,
    method = 'GET',
    body?: unknown,
    token = owner,
  ): Promise<T> {
    const response = await request(path, method, body, token)
    if (response.status !== 200) {
      const failure = (await response.json()) as { error?: string }
      throw new Error(
        `${method} ${path}: ${response.status} ${failure.error ?? 'Request failed'}`,
      )
    }
    expect(response.status).toBe(200)
    return (await response.json()) as T
  }

  function sha256(path: string) {
    return createHash('sha256').update(readFileSync(path)).digest('hex')
  }

  try {
    const original = workspace(checkedFile('original.sqlite'), 'original')
    const sourceUpload = new FormData()
    sourceUpload.set('name', 'Independent protected source')
    sourceUpload.set(
      'file',
      new File(['tenant,name\nA,Ada\nB,Grace\n'], 'people.csv'),
    )
    const source = await call<DataSource>(
      original,
      '/api/data-sources/import',
      'POST',
      sourceUpload,
    )
    const product = new Database(':memory:')
    let productBytes: Uint8Array<ArrayBuffer>
    try {
      product.run('CREATE TABLE people (tenant TEXT, name TEXT)')
      product.run('CREATE TABLE notes (tenant TEXT, note TEXT)')
      product.query('INSERT INTO people VALUES (?, ?)').run('A', 'Copy Ada')
      product.query('INSERT INTO people VALUES (?, ?)').run('B', 'Copy Grace')
      productBytes = new Uint8Array(product.serialize())
    } finally {
      product.close()
    }
    const copyUpload = new FormData()
    copyUpload.set('name', 'Backup member copy')
    copyUpload.set('file', new File([productBytes!.buffer], 'people.sqlite'))
    const copy = await call<DatabaseConnection>(
      original,
      '/api/database-connections',
      'POST',
      copyUpload,
    )
    const sourceFlow = await call<Identified>(
      original,
      `/api/data-sources/${source.id}/api`,
      'POST',
      {
        name: 'Independent source names',
        path: '/independent-member-source',
        protocol: 'rest',
        columns: ['name'],
        limit: 10,
      },
    )
    const copyFlow = await call<Identified>(
      original,
      `/api/database-connections/${copy.id}/api`,
      'POST',
      {
        version: 1,
        name: 'Retained member copy names',
        path: '/corrupt-member-copy',
        protocol: 'rest',
        table: 'people',
        columns: ['name'],
        limit: 10,
      },
    )
    const tenant = await call<Identified>(original, '/api/tenants', 'POST', {
      label: 'Approved company',
      value: 'A',
    })
    await call<unknown>(
      original,
      `/api/data-sources/${source.id}/row-policy`,
      'PUT',
      { mode: 'tenant', column: 'tenant', version: 1, resourceVersion: 1 },
    )
    await call<unknown>(
      original,
      `/api/database-connections/${copy.id}/row-policy`,
      'PUT',
      {
        mode: 'tenant',
        version: 1,
        resourceVersion: 1,
        tables: [
          { table: 'notes', column: 'tenant' },
          { table: 'people', column: 'tenant' },
        ],
      },
    )
    for (const flow of [sourceFlow, copyFlow])
      await call<unknown>(original, `/api/flows/${flow.id}/publish`, 'POST', {
        revision: 1,
      })
    const role = await call<WorkspaceRole>(original, '/api/roles', 'POST', {
      name: 'Backup copy credential manager',
      permissions: ['runtime-keys.manage'],
    })
    const member = await call<CreatedMember>(original, '/api/members', 'POST', {
      name: 'Original copy issuer',
      role: 'custom',
      roleId: role.id,
      tenantId: tenant.id,
      access: {
        mode: 'selected',
        flowIds: [sourceFlow.id, copyFlow.id],
        dependencyUse: {
          sources: [source.id],
          databaseConnections: [copy.id],
          authConnections: [],
        },
      },
    })
    const sourceProfilePath = `/api/data-sources/${source.id}/member-fields/${member.id}`
    const sourceSummaryPath = `/api/data-sources/${source.id}/member-fields`
    const sourceCurrent = await call<SourceMemberFieldProfile>(
      original,
      sourceProfilePath,
    )
    const savedSource = await call<SourceMemberFieldProfile>(
      original,
      sourceProfilePath,
      'PUT',
      {
        version: sourceCurrent.version,
        resourceVersion: sourceCurrent.resourceVersion,
        memberAccessVersion: sourceCurrent.member.accessVersion,
        tenantAssignmentVersion: sourceCurrent.member.tenantAssignment.version,
        tenantVersion: sourceCurrent.tenant!.version,
        roleId: sourceCurrent.member.roleId,
        roleVersion: sourceCurrent.member.roleVersion,
        fields: { mode: 'selected', columns: ['name'] },
      },
    )
    const profilePath = `/api/database-connections/${copy.id}/member-fields/${member.id}`
    const summaryPath = `/api/database-connections/${copy.id}/member-fields`
    const current = await call<DatabaseMemberFieldProfile>(
      original,
      profilePath,
    )
    const savedCopy = await call<DatabaseMemberFieldProfile>(
      original,
      profilePath,
      'PUT',
      {
        version: current.version,
        resourceVersion: current.resourceVersion,
        memberAccessVersion: current.member.accessVersion,
        tenantAssignmentVersion: current.member.tenantAssignment.version,
        tenantVersion: current.tenant!.version,
        roleId: current.member.roleId,
        roleVersion: current.member.roleVersion,
        tables: current.tables.map(({ table }) => ({
          table,
          fields:
            table === 'people'
              ? { mode: 'selected', columns: ['name'] }
              : { mode: 'inherit' },
        })),
      },
    )
    expect(
      savedCopy.tables.map(({ table, profile }) => ({ table, profile })),
    ).toEqual([
      { table: 'notes', profile: { mode: 'inherit' } },
      { table: 'people', profile: { mode: 'selected', columns: ['name'] } },
    ])
    const issue = (flow: Identified) =>
      call<IssuedKey>(
        original,
        '/api/runtime-keys',
        'POST',
        {
          name: 'Original pinned copy backup caller',
          flowId: flow.id,
          permissions: ['rest'],
          releaseRevision: 1,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
        member.token,
      )
    const sourceKey = await issue(sourceFlow)
    const copyKey = await issue(copyFlow)
    for (const key of [sourceKey, copyKey]) {
      expect(key.tenantId).toBe(tenant.id)
      expect(key.releaseRevision).toBe(1)
      expect(key.issuerBinding).toEqual({
        memberId: member.id,
        action: 'runtime-keys.manage',
      })
    }
    expect(
      await call<DataRow[]>(
        original,
        '/run/independent-member-source',
        'GET',
        undefined,
        sourceKey.token,
      ),
    ).toEqual([{ name: 'Ada' }])
    expect(
      await call<DataRow[]>(
        original,
        '/run/corrupt-member-copy',
        'GET',
        undefined,
        copyKey.token,
      ),
    ).toEqual([{ name: 'Copy Ada' }])
    const sourceArtifactPath = `/api/flows/${sourceFlow.id}/backend-code?revision=1`
    const copyArtifactPath = `/api/flows/${copyFlow.id}/backend-code?revision=1`
    const sourceArtifact = await call<unknown>(original, sourceArtifactPath)
    const copyArtifact = await call<unknown>(original, copyArtifactPath)
    const originalSourceSummary = await call<MemberFieldProfileSummary>(
      original,
      sourceSummaryPath,
    )
    const originalCopySummary = await call<MemberFieldProfileSummary>(
      original,
      summaryPath,
    )
    const previewPath = `/api/database-connections/${copy.id}/preview`
    const previewInput = {
      version: 1,
      table: 'people',
      columns: ['tenant', 'name'],
      limit: 10,
    }
    const originalPreview = await call<DatabasePreview>(
      original,
      previewPath,
      'POST',
      previewInput,
    )
    expect(originalPreview.rows).toEqual([
      { tenant: 'A', name: 'Copy Ada' },
      { tenant: 'B', name: 'Copy Grace' },
    ])
    const receipt = await call<{ id: string; bytes: number }>(
      original,
      '/api/backups',
      'POST',
    )
    const downloaded = await original(`/api/backups/${receipt.id}`)
    expect(downloaded.status).toBe(200)
    const archive = new Uint8Array(await downloaded.arrayBuffer())
    expect(archive.byteLength).toBe(receipt.bytes)
    pristinePath = checkedFile('pristine-downloaded.sqlite')
    writeFileSync(pristinePath, archive)
    pristineHash = sha256(pristinePath)
    const originalAudit = await call<AuditEvent[]>(original, '/api/audit')

    const detachedPath = checkedFile('detached-unknown-copy-member-key.sqlite')
    writeFileSync(detachedPath, archive)
    expect(sha256(detachedPath)).toBe(pristineHash)
    // Mutate only this closed, detached copy of a publicly downloaded backup.
    const detached = new Database(detachedPath)
    try {
      const changed = detached
        .query(
          'UPDATE database_member_field_profiles SET columns = ? WHERE resource_id = ? AND table_name = ? AND member_id = ?',
        )
        .run(JSON.stringify(['unknown_field']), copy.id, 'people', member.id)
      expect(changed.changes).toBe(1)
    } finally {
      detached.close()
    }
    expect(sha256(pristinePath)).toBe(pristineHash)
    const restored = workspace(detachedPath, 'detached')
    const auditBeforeDenied = await call<AuditEvent[]>(restored, '/api/audit')
    const deniedRequests: [string, string][] = [
      [summaryPath, owner],
      [profilePath, owner],
      ['/run/corrupt-member-copy', copyKey.token],
    ]
    for (const [path, token] of deniedRequests) {
      const denied = await restored(path, 'GET', undefined, token)
      expect(denied.status).toBe(503)
      const body: unknown = await denied.json()
      expect(body).toEqual({ error: 'Member field profile is unavailable' })
      expect(JSON.stringify(body)).not.toContain('Ada')
      expect(JSON.stringify(body)).not.toContain('Grace')
    }
    expect(await call<AuditEvent[]>(restored, '/api/audit')).toEqual(
      auditBeforeDenied,
    )
    expect(
      await call<SourceMemberFieldProfile>(restored, sourceProfilePath),
    ).toEqual(savedSource)
    expect(
      await call<MemberFieldProfileSummary>(restored, sourceSummaryPath),
    ).toEqual(originalSourceSummary)
    expect(
      await call<DataRow[]>(
        restored,
        '/run/independent-member-source',
        'GET',
        undefined,
        sourceKey.token,
      ),
    ).toEqual([{ name: 'Ada' }])
    expect(
      await call<DatabasePreview>(restored, previewPath, 'POST', previewInput),
    ).toEqual(originalPreview)
    expect(await call<unknown>(restored, sourceArtifactPath)).toEqual(
      sourceArtifact,
    )
    expect(await call<unknown>(restored, copyArtifactPath)).toEqual(
      copyArtifact,
    )

    expect(
      await call<SourceMemberFieldProfile>(original, sourceProfilePath),
    ).toEqual(savedSource)
    expect(
      await call<DatabaseMemberFieldProfile>(original, profilePath),
    ).toEqual(savedCopy)
    expect(
      await call<MemberFieldProfileSummary>(original, sourceSummaryPath),
    ).toEqual(originalSourceSummary)
    expect(
      await call<MemberFieldProfileSummary>(original, summaryPath),
    ).toEqual(originalCopySummary)
    expect(
      await call<DatabasePreview>(original, previewPath, 'POST', previewInput),
    ).toEqual(originalPreview)
    expect(await call<unknown>(original, sourceArtifactPath)).toEqual(
      sourceArtifact,
    )
    expect(await call<unknown>(original, copyArtifactPath)).toEqual(
      copyArtifact,
    )
    expect(await call<AuditEvent[]>(original, '/api/audit')).toEqual(
      originalAudit,
    )
    expect(sha256(pristinePath)).toBe(pristineHash)
  } finally {
    try {
      for (const server of servers.reverse()) await server.close()
      if (pristinePath && pristineHash)
        expect(sha256(pristinePath)).toBe(pristineHash)
    } finally {
      const target = resolve(directory)
      if (
        resolve(target, '..') !== resolve(tmpdir()) ||
        !target.startsWith(resolve(tmpdir()) + sep) ||
        !basename(target).startsWith(prefix)
      )
        throw new Error(
          'Fixture cleanup must stay inside its OS temporary directory',
        )
      rmSync(target, { recursive: true, force: true, maxRetries: 5 })
    }
  }
})
