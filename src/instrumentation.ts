// Suppress url.parse() deprecation warning (DEP0169) from follow-redirects,
// a transitive dependency of plaid → axios → follow-redirects.
// This is a known issue in follow-redirects v1.15.x on Node.js >= 22.
// The warning is cosmetic — the functionality is unaffected.
const originalEmit = process.emit

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(process as any).emit = function (event: string, ...args: unknown[]) {
  if (
    event === 'warning' &&
    args[0] &&
    typeof args[0] === 'object' &&
    'name' in args[0] &&
    (args[0] as { name: string }).name === 'DeprecationWarning' &&
    'code' in args[0] &&
    (args[0] as { code: string }).code === 'DEP0169'
  ) {
    return false
  }
  return originalEmit.apply(process, [event, ...args] as Parameters<typeof originalEmit>)
}

export async function register() {
  // Instrumentation hook — runs once at server startup
}
