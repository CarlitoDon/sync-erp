export function parseComponentLabel(componentLabel: string) {
  const quantityMatch = componentLabel.match(/^(\d+)\s+(.+)$/);

  return {
    quantity: quantityMatch ? parseInt(quantityMatch[1], 10) : 1,
    label: quantityMatch ? quantityMatch[2] : componentLabel,
  };
}
