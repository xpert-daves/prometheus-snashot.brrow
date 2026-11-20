/**
 * zod 4's `z.regexes.email`, the rule `/api/quote` applies through
 * `z.string().email()`. Copied rather than imported so the quote page does not
 * ship zod; quoteForm.test.ts pins the two together.
 */
export const EMAIL_PATTERN =
  /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
