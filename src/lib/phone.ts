export function normalizeUS(input: string): string {
  let digits = (input || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) {
    throw new Error('Invalid US number');
  }
  return `+1${digits}`;
}

// Format for display only. Accepts partial input while typing.
// Rules:
// - If the first digit is 1, treat it as country code and format the next 10 digits
// - Otherwise, format the first 10 digits as (XXX) XXX-XXXX
// - Never drop a meaningful leading 1; show "+1 " when present
export function formatUSForDisplay(input: string): string {
  const hasPlus = input.trim().startsWith('+');
  let digits = (input || '').replace(/\D/g, '');

  let prefix = '';
  if (digits.startsWith('1')) {
    prefix = hasPlus ? '+1 ' : '1 ';
    digits = digits.slice(1, 11); // up to national 10 digits
  } else {
    digits = digits.slice(0, 10);
  }

  let formatted = '';
  if (digits.length > 0) {
    formatted = `(${digits.slice(0, 3)}`;
    if (digits.length >= 4) formatted += `) ${digits.slice(3, 6)}`;
    if (digits.length >= 7) formatted += `-${digits.slice(6, 10)}`;
  }
  return `${prefix}${formatted}`.trim();
}


