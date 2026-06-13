export function formatDate(date: Date, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
}

export function formatCurrency(amount: number, currency = "USD", locale = "en"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}
