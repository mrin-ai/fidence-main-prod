const ones = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const tens = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

function chunkToWords(value: number): string {
  if (value === 0) return "";
  if (value < 20) return ones[value] ?? "";
  if (value < 100) {
    const remainder = value % 10;
    return remainder
      ? `${tens[Math.floor(value / 10)]}-${ones[remainder]}`
      : (tens[Math.floor(value / 10)] ?? "");
  }
  if (value < 1000) {
    const remainder = value % 100;
    const hundreds = Math.floor(value / 100);
    const rest = chunkToWords(remainder);
    return rest
      ? `${ones[hundreds]} hundred ${rest}`
      : `${ones[hundreds]} hundred`;
  }

  return "";
}

function integerToWords(value: number): string {
  if (value === 0) return "zero";

  const parts: string[] = [];
  const billions = Math.floor(value / 1_000_000_000);
  const millions = Math.floor((value % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1_000);
  const remainder = value % 1_000;

  if (billions) parts.push(`${chunkToWords(billions)} billion`);
  if (millions) parts.push(`${chunkToWords(millions)} million`);
  if (thousands) parts.push(`${chunkToWords(thousands)} thousand`);
  if (remainder) parts.push(chunkToWords(remainder));

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function amountToWords(amount: number) {
  const normalized = Math.round(Math.abs(amount) * 100) / 100;
  const dollars = Math.floor(normalized);
  const cents = Math.round((normalized - dollars) * 100);

  const dollarWords = integerToWords(dollars);
  if (cents === 0) return dollarWords;

  const centWords = integerToWords(cents);
  return `${dollarWords} and ${centWords} cents`;
}
