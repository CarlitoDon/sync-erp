/**
 * Safely ensures a value is an array. Returns empty array if not.
 * Use this to guard against API responses that may not return expected arrays.
 */
export function ensureArray<T>(data: unknown): T[] {
  if (!Array.isArray(data)) {
    if (data !== null && data !== undefined) {
      console.warn(
        '[ensureArray] Expected array but got:',
        typeof data,
        data
      );
    }
    return [];
  }
  return data as T[];
}

/**
 * Extracts data from API response, handling both direct and wrapped responses.
 * Supports: { data: T } or T directly
 */
export function extractData<T>(response: unknown): T | undefined {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response
  ) {
    return (response as { data: T }).data;
  }
  return response as T | undefined;
}

/**
 * Extracts array from API response safely.
 * Handles: { data: T[] } or T[] directly
 */
export function extractArray<T>(response: unknown): T[] {
  const data = extractData<T[]>(response);
  return ensureArray<T>(data);
}
