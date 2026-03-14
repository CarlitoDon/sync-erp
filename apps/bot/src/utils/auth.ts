export const parseBearerToken = (
  header?: string | null
): string | null => {
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
};
