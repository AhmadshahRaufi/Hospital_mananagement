// Minimal number-to-words for printed invoices ("Amount in words: ...").
// Good for typical clinic bill amounts (up to billions); intentionally
// dependency-free rather than pulling in a package for one line of text.
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function chunkToWords(n) {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + chunkToWords(n % 100) : "");
}

export function numberToWords(amount) {
  const value = Math.round(Math.abs(Number(amount) || 0));
  if (value === 0) return "Zero";

  const scales = [
    ["", 1],
    ["Thousand", 1000],
    ["Million", 1000000],
    ["Billion", 1000000000],
  ];

  let remaining = value;
  const parts = [];
  for (let i = scales.length - 1; i >= 0; i--) {
    const [label, size] = scales[i];
    const chunk = Math.floor(remaining / size);
    remaining %= size;
    if (chunk > 0) {
      parts.push(chunkToWords(chunk) + (label ? " " + label : ""));
    }
  }
  return parts.join(" ").trim();
}

export function amountInWords(amount, currency = "") {
  const words = numberToWords(amount);
  return currency ? `${currency} ${words} Only` : `${words} Only`;
}
