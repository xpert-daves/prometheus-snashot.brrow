/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.shed210.com/quote"}
 */
import {
  trackQuoteStepInClarity,
  trackSavedQuoteInClarity,
  WEBSITE_MEASUREMENT_OPT_OUT_KEY,
} from '../websiteMeasurement';

it('emits a distinct saved-request event once without quote details and honors opt-out', () => {
  const clarity = jest.fn();
  const browser = window as Window & { clarity?: typeof clarity };
  browser.clarity = clarity;
  localStorage.clear();
  trackSavedQuoteInClarity('saved-quote-1'); trackSavedQuoteInClarity('saved-quote-1');
  expect(clarity).toHaveBeenCalledTimes(1);
  expect(clarity).toHaveBeenCalledWith('event', 'quote_request_saved');
  localStorage.setItem(WEBSITE_MEASUREMENT_OPT_OUT_KEY, 'true');
  trackSavedQuoteInClarity('saved-quote-2');
  expect(clarity).toHaveBeenCalledTimes(1);
  delete browser.clarity; localStorage.clear();
});

it('emits each quote step once per page load for the Clarity funnel and honors opt-out', () => {
  const clarity = jest.fn();
  const browser = window as Window & { clarity?: typeof clarity };
  browser.clarity = clarity;
  localStorage.clear();
  trackQuoteStepInClarity(0); trackQuoteStepInClarity(1); trackQuoteStepInClarity(0);
  trackQuoteStepInClarity(7);
  expect(clarity.mock.calls).toEqual([
    ['event', 'quote_step_1_size'],
    ['event', 'quote_step_2_materials'],
  ]);
  localStorage.setItem(WEBSITE_MEASUREMENT_OPT_OUT_KEY, 'true');
  trackQuoteStepInClarity(2);
  expect(clarity).toHaveBeenCalledTimes(2);
  localStorage.clear();
  trackQuoteStepInClarity(2);
  expect(clarity).toHaveBeenLastCalledWith('event', 'quote_step_3_contact');
  delete browser.clarity; localStorage.clear();
});
