/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'

const SERVER_SECRET_MODULES = [
  'src/lib/crmProjects.server.ts',
  'src/lib/googleReviews.server.ts',
  'src/lib/quotePersistence.ts',
  'src/lib/quotePricingSettings.ts',
  'src/lib/quoteRateLimit.ts',
] as const

describe('server-only module boundaries', () => {
  it.each(SERVER_SECRET_MODULES)('%s rejects accidental client imports', (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')

    expect(source).toMatch(/^import ["']server-only["'];?/)
  })
})
