import { expect, type Page, type Route } from '@playwright/test'

type Capture = (
  group: string,
  title: string,
  detail: string,
  options?: { fullPage?: boolean },
) => Promise<void>

export async function invitationPreviews({
  page,
  owner,
  apiOrigin,
  capture,
}: {
  page: Page
  owner: string
  apiOrigin: string
  capture: Capture
}) {
  const suffix = crypto.randomUUID().slice(0, 8)
  const memberName = `Invited reader ${suffix}`
  const email = `reader-${suffix}@example.test`
  await page.setViewportSize({ width: 1440, height: 900 })
  async function appearance(mode: 'Light' | 'Dark' | 'System') {
    await page
      .getByRole('combobox', { name: 'Appearance', exact: true })
      .click()
    await page.getByRole('option', { name: mode, exact: true }).click()
  }
  async function phone(title: string, target = panel) {
    await target.evaluate((element) =>
      element.scrollIntoView({ block: 'start' }),
    )
    await expect(target).toBeInViewport()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    await capture(
      'Invitations',
      title,
      'Native 390-pixel viewport keeps ordinary controls and full invitation guidance readable. Link and password values are masked.',
      { fullPage: false },
    )
  }
  async function holdDelivery(path: string, method: string, abort = false) {
    let release!: () => void
    let ready!: (status: number) => void
    let finish!: () => void
    let fail!: (error: unknown) => void
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    const response = new Promise<number>((resolve) => {
      ready = resolve
    })
    const settled = new Promise<void>((resolve, reject) => {
      finish = resolve
      fail = reject
    })
    const pattern = `**${path}`
    const handler = async (route: Route) => {
      if (route.request().method() !== method) return route.continue()
      try {
        const actual = await route.fetch({ maxRedirects: 0 })
        ready(actual.status())
        await released
        if (abort) await route.abort('failed')
        else await route.fulfill({ response: actual })
        finish()
      } catch (error) {
        fail(error)
        throw error
      }
    }
    await page.route(pattern, handler)
    return {
      response,
      async close() {
        release()
        await settled
        await page.unroute(pattern, handler)
      },
    }
  }
  if (
    await page.getByRole('button', { name: 'Sign out', exact: true }).count()
  ) {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(
      page.getByLabel('Workspace token', { exact: true }),
    ).toBeVisible()
  }
  const response = await page.request.post(`${apiOrigin}/api/members`, {
    headers: { authorization: `Bearer ${owner}` },
    data: { name: memberName, role: 'viewer' },
  })
  expect(response.status()).toBe(200)
  const created = (await response.json()) as { id: string }
  const inventory = await page.request.get(`${apiOrigin}/api/members`, {
    headers: { authorization: `Bearer ${owner}` },
  })
  expect(inventory.status()).toBe(200)
  const members = (await inventory.json()) as {
    id: string
    hasAccount: boolean
  }[]
  expect(members.find((member) => member.id === created.id)?.hasAccount).toBe(
    false,
  )

  await page.goto(apiOrigin, { timeout: 30_000 })
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Your team', exact: true }),
  ).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: memberName })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Invite sign-in', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Sign-in invitation' })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText(memberName)
  await expect(
    panel.getByLabel('Invitation email', { exact: true }),
  ).toBeVisible()
  await expect(panel).toContainText('24 hours')
  await expect(
    panel.getByRole('button', { name: 'Create invitation link' }),
  ).toBeVisible()
  await panel.getByLabel('Invitation email', { exact: true }).fill(email)
  await capture(
    'Invitations',
    'Owner invitation form',
    'Existing key-only member selected. Fixed 24-hour link leaves role, API access and tenant assignment unchanged; Besh sends no email.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await appearance('Light')
  await phone('Phone light owner invitation form')
  await appearance('Dark')
  await phone('Phone dark owner invitation form')
  await page.setViewportSize({ width: 1440, height: 900 })
  await appearance('Light')
  const issued = page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === '/api/invitations' &&
      result.request().method() === 'POST',
  )
  await panel
    .getByRole('button', { name: 'Create invitation link', exact: true })
    .click()
  expect((await issued).status()).toBe(200)
  const link = await panel
    .getByLabel('Invitation link', { exact: true })
    .inputValue()
  await capture(
    'Invitations',
    'One-time invitation link',
    'Actual creation receipt shows a masked link once, its member and fixed expiry. Holder can set this member password; email ownership is not proven.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await phone(
    'Phone light one-time invitation link',
    panel.locator('.issued-token'),
  )
  await appearance('Dark')
  await phone(
    'Phone dark one-time invitation link',
    panel.locator('.issued-token'),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await appearance('Light')
  await panel
    .getByRole('button', { name: 'I saved the link', exact: true })
    .click()
  await page.goto('about:blank')
  const privateReads: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) privateReads.push(url.pathname)
  })
  try {
    await page.goto(link, { timeout: 30_000 })
  } catch {
    throw new Error('Could not open the invitation page.')
  }
  await expect(
    page.getByRole('heading', { name: 'Accept invitation', exact: true }),
  ).toBeVisible()
  expect(new URL(page.url()).hash === '').toBe(true)
  await expect(
    page.getByRole('region', { name: 'Current sign-in' }),
  ).toContainText('Owner')
  await expect(
    page.getByRole('button', {
      name: 'Sign out to accept invitation',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Set password', exact: true }),
  ).toBeDisabled()
  expect(privateReads).toEqual([])
  await capture(
    'Invitations',
    'Existing sign-in requires explicit logout',
    'Fragment already removed. Public preview uses only public invitation and session endpoints; existing owner cannot claim another member password while signed in.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  const currentSignIn = page.getByRole('region', { name: 'Current sign-in' })
  await phone('Phone light existing sign-in guard', currentSignIn)
  await appearance('Dark')
  await phone('Phone dark existing sign-in guard', currentSignIn)
  await page.setViewportSize({ width: 1440, height: 900 })
  await appearance('Light')
  await page
    .getByRole('button', { name: 'Return to workspace', exact: true })
    .click()
  await page.getByRole('button', { name: 'API Studio', exact: true }).click()
  await expect(page.getByLabel('API name', { exact: true })).toBeVisible()
  privateReads.length = 0
  await page.evaluate((invitationLink) => {
    location.hash = new URL(invitationLink).hash
  }, link)
  await expect(
    page.getByRole('heading', { name: 'Accept invitation', exact: true }),
  ).toBeVisible()
  expect(new URL(page.url()).hash === '').toBe(true)
  await expect(
    page.getByRole('region', { name: 'Current sign-in' }),
  ).toContainText('Owner')
  expect(privateReads).toEqual([])

  await page
    .getByRole('button', { name: 'Return to workspace', exact: true })
    .click()
  await page
    .getByLabel('API name', { exact: true })
    .fill('Unsaved invitation draft')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.evaluate((invitationLink) => {
    location.hash = new URL(invitationLink).hash
  }, link)
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Unsaved invitation draft',
  )
  expect(new URL(page.url()).hash === '').toBe(true)
  page.once('dialog', (dialog) => dialog.accept())
  await page.evaluate((invitationLink) => {
    location.hash = new URL(invitationLink).hash
  }, link)
  await expect(
    page.getByRole('heading', { name: 'Accept invitation', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Return to workspace', exact: true })
    .click()
  await expect(page.getByLabel('API name', { exact: true })).toHaveValue(
    'Unsaved invitation draft',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.evaluate((invitationLink) => {
    location.hash = new URL(invitationLink).hash
  }, link)
  const logout = page.getByRole('button', {
    name: 'Sign out to accept invitation',
    exact: true,
  })
  await expect(logout).toBeVisible()
  page.once('dialog', (dialog) => dialog.dismiss())
  await logout.click()
  await expect(currentSignIn).toContainText('Owner')
  page.once('dialog', (dialog) => dialog.accept())
  const loggedOut = page.waitForResponse(
    (result) => new URL(result.url()).pathname === '/auth/logout',
  )
  await logout.click()
  expect((await loggedOut).status()).toBe(200)
  await expect(currentSignIn).toContainText('No workspace sign-in is active')
  await expect(
    page.getByRole('button', { name: 'Return to workspace', exact: true }),
  ).toHaveCount(0)
  expect((await page.request.get(`${apiOrigin}/auth/session`)).status()).toBe(
    401,
  )
  await page
    .getByLabel('Invitation password', { exact: true })
    .fill('Invitation-proof-password-17')
  await page
    .getByLabel('Confirm invitation password', { exact: true })
    .fill('Invitation-proof-password-17')
  await capture(
    'Invitations',
    'Password setup after explicit sign-out',
    'Original owner session ended by explicit logout. Password inputs are masked; setting a password does not sign anyone in.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await phone(
    'Phone light invitation password form',
    page.getByLabel('Invitation password', { exact: true }),
  )
  await appearance('Dark')
  await phone(
    'Phone dark invitation password form',
    page.getByLabel('Invitation password', { exact: true }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await appearance('Light')
  const claimed = page.waitForResponse(
    (result) => new URL(result.url()).pathname === '/auth/invitations/accept',
  )
  const heldClaim = await holdDelivery('/auth/invitations/accept', 'POST')
  await page.getByRole('button', { name: 'Set password', exact: true }).click()
  expect(await heldClaim.response).toBe(200)
  try {
    await expect(
      page.getByRole('button', { name: 'Set password', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', {
        name: 'Leave invitation and sign in',
        exact: true,
      }),
    ).toBeDisabled()
    await capture(
      'Invitations',
      'Password claim pending holds navigation',
      'Real claim already reached the server; delivery is held. Password values masked, repeated submission and leaving stay disabled until it settles.',
    )
  } finally {
    await heldClaim.close()
  }
  expect((await claimed).status()).toBe(200)
  await expect(
    page.getByRole('heading', { name: 'Password set', exact: true }),
  ).toBeVisible()
  expect((await page.request.get(`${apiOrigin}/auth/session`)).status()).toBe(
    401,
  )
  expect(privateReads).toEqual([])
  await capture(
    'Invitations',
    'Password set without automatic sign-in',
    'Actual password claim succeeded and no workspace session exists. Secret cleared; ordinary sign-in remains an explicit separate action.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await phone(
    'Phone light invitation result',
    page.getByRole('heading', { name: 'Password set', exact: true }),
  )
  await appearance('Dark')
  await phone(
    'Phone dark invitation result',
    page.getByRole('heading', { name: 'Password set', exact: true }),
  )
  await appearance('System')
  await phone(
    'Phone system invitation result',
    page.getByRole('heading', { name: 'Password set', exact: true }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await appearance('Light')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page
    .getByRole('button', { name: 'Email & password', exact: true })
    .click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page
    .getByLabel('Password', { exact: true })
    .fill('Invitation-proof-password-17')
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(page.locator('.sidebar-bottom')).toContainText(memberName)
  const signedIn = await page.request.get(`${apiOrigin}/auth/session`)
  expect(signedIn.status()).toBe(200)
  expect(
    ((await signedIn.json()) as { member: { id: string } }).member.id,
  ).toBe(created.id)
  await capture(
    'Invitations',
    'Invited member signs in explicitly',
    'Ordinary email and password sign-in now opens the original viewer member; no owner identity or extra access was inherited.',
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Members', exact: true }),
  ).toBeVisible()

  const replacementLinks: string[] = []
  const replacementNames = [
    `First invitation ${suffix}`,
    `Replacement invitation ${suffix}`,
  ]
  for (const [index, name] of replacementNames.entries()) {
    const person = await page.request.post(`${apiOrigin}/api/members`, {
      headers: { authorization: `Bearer ${owner}` },
      data: { name, role: 'viewer' },
    })
    expect(person.status()).toBe(200)
    const subject = (await person.json()) as { id: string }
    const invitation = await page.request.post(`${apiOrigin}/api/invitations`, {
      headers: { authorization: `Bearer ${owner}`, origin: apiOrigin },
      data: {
        memberId: subject.id,
        email: `replacement-${index}-${suffix}@example.test`,
      },
    })
    expect(invitation.status()).toBe(200)
    const receipt = (await invitation.json()) as { token: string }
    const url = new URL('/', apiOrigin)
    url.hash = `invite=${receipt.token}`
    replacementLinks.push(url.href)
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.goto('about:blank')
  privateReads.length = 0
  try {
    await page.goto(replacementLinks[0]!, { timeout: 30_000 })
  } catch {
    throw new Error('Could not open the first invitation page.')
  }
  await expect(
    page.getByText(replacementNames[0]!, { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByLabel('Invitation password', { exact: true }),
  ).toBeEnabled()
  await page.evaluate((invitationLink) => {
    location.hash = new URL(invitationLink).hash
  }, replacementLinks[1]!)
  await expect(
    page.getByText(replacementNames[1]!, { exact: false }),
  ).toBeVisible()
  expect(new URL(page.url()).hash === '').toBe(true)
  expect(privateReads).toEqual([])
  await capture(
    'Invitations',
    'Signed-out public link replacement',
    'A new link in the same document replaces the old public preview. No workspace restoration, private reads or automatic sign-in occurs.',
  )
  await page
    .getByRole('button', { name: 'Leave invitation and sign in', exact: true })
    .click()
  await page.getByLabel('Workspace token', { exact: true }).fill(owner)
  await page
    .getByRole('button', { name: 'Open workspace', exact: true })
    .click()
  const recoveryName = `Invitation recovery ${suffix}`
  const recoveryEmail = `recovery-${suffix}@example.test`
  const recoveryMemberResponse = await page.request.post(
    `${apiOrigin}/api/members`,
    {
      headers: { authorization: `Bearer ${owner}` },
      data: { name: recoveryName, role: 'viewer' },
    },
  )
  expect(recoveryMemberResponse.status()).toBe(200)
  const recoveryMember = (await recoveryMemberResponse.json()) as { id: string }
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page
    .getByRole('row')
    .filter({ hasText: recoveryName })
    .getByRole('button', { name: 'Invite sign-in', exact: true })
    .click()
  await panel
    .getByLabel('Invitation email', { exact: true })
    .fill(recoveryEmail)
  let metadataReads = 0
  const trackMetadata = (request: import('@playwright/test').Request) => {
    if (
      new URL(request.url()).pathname === '/api/invitations' &&
      request.method() === 'GET'
    )
      metadataReads++
  }
  page.on('request', trackMetadata)
  const lostIssue = await holdDelivery('/api/invitations', 'POST', true)
  await panel
    .getByRole('button', { name: 'Create invitation link', exact: true })
    .click()
  expect(await lostIssue.response).toBe(200)
  try {
    await expect(
      page.getByRole('button', { name: 'API Studio', exact: true }),
    ).toBeDisabled()
    await expect(
      panel.getByRole('button', { name: 'Close invitations', exact: true }),
    ).toBeDisabled()
    await capture(
      'Invitations',
      'Invitation creation pending',
      'Real creation is held at delivery. Member, email and global navigation cannot change while the one-time receipt is pending.',
    )
  } finally {
    await lostIssue.close()
  }
  await expect(panel.getByRole('alert')).toContainText(
    'Could not confirm whether the invitation was created',
  )
  await expect(
    panel.getByRole('button', { name: 'Create invitation link', exact: true }),
  ).toBeDisabled()
  await expect(
    panel.getByRole('combobox', { name: 'Invitation member', exact: true }),
  ).toBeDisabled()
  expect(metadataReads).toBe(0)
  await capture(
    'Invitations',
    'Lost invitation receipt requires refresh',
    'The server committed creation, but transport dropped its one-time receipt. No automatic read or replay; choices remain and explicit metadata refresh is required.',
  )
  await panel
    .getByRole('button', { name: 'Refresh invitations', exact: true })
    .click()
  const pending = panel.locator('article').filter({ hasText: recoveryName })
  await expect(pending).toContainText(recoveryEmail)
  await expect(
    panel.getByRole('button', { name: 'Create invitation link', exact: true }),
  ).toBeEnabled()
  await capture(
    'Invitations',
    'Refresh finds committed pending invitation',
    'Current active metadata confirms the committed record without replaying the lost secret. Owner may explicitly reissue or revoke this member link.',
  )
  await panel
    .getByRole('button', { name: 'Create invitation link', exact: true })
    .click()
  const recoveryLinkField = panel.getByLabel('Invitation link', { exact: true })
  await expect(recoveryLinkField).toBeVisible()
  const recoveryLink = await recoveryLinkField.inputValue()
  await capture(
    'Invitations',
    'Explicit invitation reissue',
    'Actual new creation invalidates the previous link for this member; the new masked one-time receipt must be saved privately.',
  )
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await panel
    .getByRole('button', { name: 'Copy invitation link', exact: true })
    .click()
  expect(
    await page.evaluate(
      async (expected) => (await navigator.clipboard.readText()) === expected,
      recoveryLink,
    ),
  ).toBe(true)
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await capture(
    'Invitations',
    'Invitation link copied privately',
    'Ordinary copy action copies the new link; screenshot masks it. Test clears clipboard after confirming exact content.',
  )
  const failedMetadata = async (route: Route) => {
    if (route.request().method() === 'GET') await route.abort('failed')
    else await route.continue()
  }
  await page.route('**/api/invitations', failedMetadata)
  await panel
    .getByRole('button', { name: 'Refresh invitations', exact: true })
    .click()
  await expect(panel.getByRole('alert')).toBeVisible()
  await expect(
    panel.getByRole('button', { name: 'Copy invitation link', exact: true }),
  ).toBeDisabled()
  expect((await recoveryLinkField.inputValue()) === recoveryLink).toBe(true)
  await capture(
    'Invitations',
    'Metadata failure retains unconfirmed receipt',
    'A failed explicit read keeps the memory-held one-time receipt, labels its status unconfirmed and blocks copy as a current link.',
  )
  await page.unroute('**/api/invitations', failedMetadata)
  await panel
    .getByRole('button', { name: 'Refresh invitations', exact: true })
    .click()
  await expect(
    panel.getByRole('button', { name: 'Copy invitation link', exact: true }),
  ).toBeEnabled()
  async function currentRecoveryInvitation() {
    const list = await page.request.get(`${apiOrigin}/api/invitations`, {
      headers: { authorization: `Bearer ${owner}` },
    })
    expect(list.status()).toBe(200)
    const invitations = (await list.json()) as {
      id: string
      memberId: string
    }[]
    return invitations.find((item) => item.memberId === recoveryMember.id)!
  }
  const recoveryInvitation = await currentRecoveryInvitation()
  expect(
    (
      await page.request.delete(
        `${apiOrigin}/api/invitations/${recoveryInvitation.id}`,
        { headers: { authorization: `Bearer ${owner}` } },
      )
    ).status(),
  ).toBe(200)
  await panel
    .getByRole('button', { name: 'Refresh invitations', exact: true })
    .click()
  await expect(panel).toContainText('This invitation is no longer active')
  await expect(
    panel.getByRole('button', { name: 'Copy invitation link', exact: true }),
  ).toBeDisabled()
  await capture(
    'Invitations',
    'Refreshed receipt is no longer active',
    'Successful current metadata read no longer contains this receipt ID. Old link is retained for acknowledgement, clearly inactive and not copyable as a current link.',
  )
  await panel
    .getByRole('button', { name: 'I saved the link', exact: true })
    .click()
  await panel
    .getByRole('button', { name: 'Create invitation link', exact: true })
    .click()
  await expect(recoveryLinkField).toBeVisible()
  await panel
    .getByRole('button', { name: 'I saved the link', exact: true })
    .click()
  const currentRecord = await currentRecoveryInvitation()
  const heldRevoke = await holdDelivery(
    `/api/invitations/${currentRecord.id}`,
    'DELETE',
  )
  await pending
    .getByRole('button', { name: 'Revoke invitation', exact: true })
    .click()
  expect(await heldRevoke.response).toBe(200)
  try {
    await expect(
      panel.getByRole('button', { name: 'Close invitations', exact: true }),
    ).toBeDisabled()
    await capture(
      'Invitations',
      'Exact invitation revocation pending',
      'Real exact-ID revocation is held in delivery; navigation and other changes remain disabled.',
    )
  } finally {
    await heldRevoke.close()
  }
  await expect(pending).toHaveCount(0)
  await capture(
    'Invitations',
    'Owner revoked exact invitation',
    'Only the reviewed pending invitation is removed. Other members and their sign-in methods are unchanged.',
  )
  page.off('request', trackMetadata)
  await panel
    .getByRole('button', { name: 'Close invitations', exact: true })
    .click()
}
