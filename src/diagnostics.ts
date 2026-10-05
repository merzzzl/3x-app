export function errorDetails(error: unknown) {
  if (!(error instanceof Error)) return { name: 'UnknownError' };
  const source = error as Error & { code?: unknown; syscall?: unknown; cause?: unknown };
  const cause = source.cause as { code?: unknown } | undefined;
  const safeCode = (value: unknown) =>
    typeof value === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(value) ? value : undefined;
  return {
    name: safeCode(source.name),
    code: safeCode(source.code) ?? safeCode(cause?.code),
    syscall: safeCode(source.syscall),
  };
}
