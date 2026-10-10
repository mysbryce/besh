export {}

// The compiled child dispatch stays ahead of every portable/server import.
if (Bun.isStandaloneExecutable && process.argv[2] === '--besh-sqlite-reader') {
  if (process.argv.length !== 3) {
    process.stdout.write(
      JSON.stringify({ error: 'Unsupported SQLite reader arguments' }),
    )

    process.exitCode = 1
  } else {
    await import('../databases/worker')
  }
} else if (process.argv[2] === 'licenses') {
  const { join, resolve } = await import('node:path')
  const { PortableError } = await import('./cli')

  try {
    const { dispatchPortableLicenses } = await import('./licenses')

    const assets = Bun.isStandaloneExecutable
      ? join(import.meta.dir, 'portable-notices')
      : resolve(import.meta.dir, '../../assets/portable-notices')

    await dispatchPortableLicenses(process.argv.slice(2), assets)
  } catch (error) {
    console.error(
      error instanceof PortableError
        ? error.message
        : 'Besh could not complete the license export.',
    )

    process.exitCode = 1
  }
} else {
  const { PortableError, options, ready } = await import('./cli')

  try {
    const selected = options(process.argv.slice(2))

    if (selected.command === 'run') {
      const { serve } = await import('./server')

      await serve(selected)
    } else {
      const { spawn } = await import('node:child_process')
      const { fileURLToPath } = await import('node:url')
      const { dataRoot, readInstance, control, waitStopped } =
        await import('./instance')
      const { openBrowser } = await import('./browser')

      const directory = dataRoot(
        selected.dataDirectory,
        selected.command === 'start',
      )
      let instance = directory ? readInstance(directory) : undefined

      if (
        selected.command === 'start' &&
        directory &&
        (!instance || instance === 'starting')
      ) {
        let failed = false

        if (!instance) {
          const args = [
            'run',
            '--no-open',
            '--port',
            String(selected.port),
            '--data-dir',
            directory,
          ]
          const invocation = Bun.isStandaloneExecutable
            ? args
            : [
                '--no-env-file',
                '--no-install',
                fileURLToPath(new URL('./index.ts', import.meta.url)),
                ...args,
              ]

          const child = spawn(process.execPath, invocation, {
            detached: true,
            windowsHide: true,
            stdio: 'ignore',
            env: process.env,
          })

          child.once('error', () => {
            failed = true
          })
          child.once('exit', (code) => {
            if (code !== 0) failed = true
          })
          child.unref()
        }

        const deadline = Date.now() + 10_000

        do {
          await Bun.sleep(100)
          // The concurrent winner is checked before this launcher's losing child.
          instance = readInstance(directory)
          if (instance && instance !== 'starting') break

          if (failed && !instance)
            throw new PortableError(
              'Besh background startup failed. Check the selected data directory and port.',
            )
        } while (Date.now() < deadline)
      }

      if (instance === 'starting')
        throw new PortableError(
          'Besh instance did not become ready. Workspace ownership is uncertain.',
        )

      if (!instance) {
        if (selected.command === 'status' || selected.command === 'stop')
          console.log(JSON.stringify({ state: 'stopped' }))
        else
          throw new PortableError(
            'No verified Besh instance is running for this workspace.',
          )
      } else {
        await control(instance, 'identity')

        if (selected.command === 'status')
          console.log(
            JSON.stringify({
              state: 'running',
              url: new URL(instance.publicURL).origin,
            }),
          )
        else if (selected.command === 'stop') {
          await control(instance, 'stop')
          await waitStopped(instance)

          console.log(JSON.stringify({ state: 'stopped' }))
        } else {
          if (!selected.noOpen) {
            const current = await control(instance, 'open')
            await openBrowser(current.openURL as string, selected.browser)
          }

          ready(instance.publicURL)
        }
      }
    }
  } catch (error) {
    console.error(
      error instanceof PortableError
        ? error.message
        : 'Besh could not complete the portable command safely.',
    )

    process.exitCode = 1
  }
}
