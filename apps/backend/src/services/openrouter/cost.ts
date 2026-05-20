export type TPriceRow = {
  prompt_price_per_1m: string;
  completion_price_per_1m: string;
};

export const calculateCost = (
  tokensIn: number,
  tokensOut: number,
  price: TPriceRow
): number => {
  const inCost = (tokensIn * parseFloat(price.prompt_price_per_1m)) / 1_000_000;
  const outCost = (tokensOut * parseFloat(price.completion_price_per_1m)) / 1_000_000;
  return inCost + outCost;
};
