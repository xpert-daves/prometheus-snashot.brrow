import type { MouseEvent } from 'react';
import {
  QUOTE_RESUME_EVENT,
  clearRequestedQuoteStructureType,
  getRequestedQuoteStructureType,
  resumeQuoteFromLink,
} from '../quoteNavigation';

afterEach(() => { document.body.innerHTML = ''; jest.restoreAllMocks(); });
it('intercepts only unmodified same-page quote clicks when the form is mounted', () => {
  window.history.replaceState({}, '', '/quote');
  const listener = jest.fn(); window.addEventListener(QUOTE_RESUME_EVENT, listener);
  const event = { defaultPrevented: false, button: 0, preventDefault: jest.fn() } as unknown as MouseEvent<HTMLAnchorElement>;
  resumeQuoteFromLink(event, '/quote'); expect(event.preventDefault).not.toHaveBeenCalled();
  document.body.innerHTML = '<form id="quote-active-step-form"></form>';
  resumeQuoteFromLink({ ...event, ctrlKey: true }, '/quote'); expect(event.preventDefault).not.toHaveBeenCalled();
  resumeQuoteFromLink(event, '/contact'); expect(event.preventDefault).not.toHaveBeenCalled();
  resumeQuoteFromLink(event, '/quote'); expect(event.preventDefault).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener(QUOTE_RESUME_EVENT, listener);
});

it('accepts only supported public building types from quote links', () => {
  expect(getRequestedQuoteStructureType('?structureType=greenhouse')).toBe('greenhouse');
  expect(getRequestedQuoteStructureType('?structureType=warehouse')).toBeNull();
  expect(getRequestedQuoteStructureType('?structureType=portable_garage')).toBeNull();
  expect(getRequestedQuoteStructureType('')).toBeNull();
});

it('clears a consumed type request without losing attribution or router state', () => {
  const state = { marker: 'saved-router-state' };
  window.history.replaceState(state, '', '/quote?structureType=greenhouse&utm_source=google#details');
  clearRequestedQuoteStructureType();
  expect(window.location.pathname).toBe('/quote');
  expect(window.location.search).toBe('?utm_source=google');
  expect(window.location.hash).toBe('#details');
  expect(window.history.state).toEqual(state);
});

it('does not intercept a link requesting a building type as a generic resume', () => {
  window.history.replaceState({}, '', '/quote');
  document.body.innerHTML = '<form id="quote-active-step-form"></form>';
  const event = { defaultPrevented: false, button: 0, preventDefault: jest.fn() } as unknown as MouseEvent<HTMLAnchorElement>;
  resumeQuoteFromLink(event, '/quote?structureType=greenhouse');
  expect(event.preventDefault).not.toHaveBeenCalled();
});
