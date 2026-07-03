export function toExternalSku(value: string, prefix = 'SL-') {
  return `${prefix}${value.toLowerCase().replace(/\s+/g, '-')}`;
}
