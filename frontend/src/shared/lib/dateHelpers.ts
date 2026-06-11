// Returns a PrimeVue DatePicker format string (dd/mm/yy tokens) derived from
// the browser's locale — e.g. 'de-CH' → 'dd.mm.yy', 'en-US' → 'mm/dd/yy'.
export function getLocaleDateFormat(locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(2024, 11, 25)); // Dec 25 2024 — all fields unambiguous

  return parts
    .map((part) => {
      switch (part.type) {
        case 'year':
          return 'yy';
        case 'month':
          return 'mm';
        case 'day':
          return 'dd';
        default:
          return part.value; // separator (., /, -)
      }
    })
    .join('');
}
