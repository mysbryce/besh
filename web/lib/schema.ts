import { z } from 'zod'

// Browser validation must work without weakening the content security policy.
z.config({ jitless: true })
