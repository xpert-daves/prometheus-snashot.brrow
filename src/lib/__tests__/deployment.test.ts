import {
  isLocalOrPreviewDeployment,
  shouldEnforceCanonicalHost,
} from '../deployment'

describe('deployment helpers', () => {
  describe('shouldEnforceCanonicalHost', () => {
    it('returns false for Vercel preview deployments', () => {
      expect(
        shouldEnforceCanonicalHost({
          NODE_ENV: 'production',
          VERCEL_ENV: 'preview',
        })
      ).toBe(false)
    })

    it('returns true for Vercel production deployments', () => {
      expect(
        shouldEnforceCanonicalHost({
          NODE_ENV: 'production',
          VERCEL_ENV: 'production',
        })
      ).toBe(true)
    })

    it('returns true for non-Vercel production environments', () => {
      expect(
        shouldEnforceCanonicalHost({
          NODE_ENV: 'production',
        })
      ).toBe(true)
    })

    it('returns false outside production', () => {
      expect(
        shouldEnforceCanonicalHost({
          NODE_ENV: 'development',
          VERCEL_ENV: 'preview',
        })
      ).toBe(false)
    })
  })

  describe('isLocalOrPreviewDeployment', () => {
    it('returns true for local development', () => {
      expect(isLocalOrPreviewDeployment({ NODE_ENV: 'development' })).toBe(true)
    })

    it('returns true for Vercel preview builds', () => {
      expect(
        isLocalOrPreviewDeployment({
          NODE_ENV: 'production',
          VERCEL_ENV: 'preview',
        })
      ).toBe(true)
    })

    it('returns false for Vercel production builds', () => {
      expect(
        isLocalOrPreviewDeployment({
          NODE_ENV: 'production',
          VERCEL_ENV: 'production',
        })
      ).toBe(false)
    })
  })

})
