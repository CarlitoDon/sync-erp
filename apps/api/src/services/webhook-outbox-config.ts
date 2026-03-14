export const readPositiveInt = (
  rawValue: string | undefined,
  fallback: number
) => {
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

export const isRetryableStatusCode = (statusCode: number) => {
  return statusCode >= 500 || statusCode === 408 || statusCode === 429;
};
