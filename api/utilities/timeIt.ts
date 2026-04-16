export async function timeIt<T>(
  label: string,
  fn: () => Promise<T>,
  logger?: any,
  extraFields?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration_ms = Math.round(performance.now() - start);
    logger?.info({ stage: label, duration_ms, ...extraFields }, `${label} completed`);
    return result;
  } catch (error) {
    const duration_ms = Math.round(performance.now() - start);
    logger?.info({ stage: label, error, duration_ms, ...extraFields }, `${label} failed`);
    throw error;
  }
}
