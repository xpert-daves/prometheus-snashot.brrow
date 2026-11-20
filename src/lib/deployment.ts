export function shouldEnforceCanonicalHost(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === 'production' && env.VERCEL_ENV?.toLowerCase() !== 'preview'
}

export function isLocalOrPreviewDeployment(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV !== 'production' || env.VERCEL_ENV?.toLowerCase() === 'preview'
}
