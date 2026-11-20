/** @jest-environment node */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const crawlerUrl = pathToFileURL(path.resolve('scripts/crawl-built-site.mjs')).href;

function runCrawler(scenario = 'valid') {
  // Exercise the real CLI against an in-memory site; no server or network needed.
  const fixture = `
    const scenario = ${JSON.stringify(scenario)};
    const paths = ['/', '/service-area/san-antonio', '/service-area/universal-city',
      '/service-area', '/gallery', '/news', '/news/san-antonio-shed-cost-guide',
      '/news/sanantonio_shed_guide', '/projects/example'];
    const canonicalOrigin = 'https://www.shed210.com';
    process.argv = ['node', 'crawler', 'http://localhost:3100', '--indexing-only'];
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      if (url.pathname === '/sitemap.xml') {
        return { ok: true, text: async () => '<urlset>' + paths.map(p =>
          '<url><loc>' + canonicalOrigin + p + '</loc></url>').join('') + '</urlset>' };
      }
      const affected = url.pathname === '/projects/example';
      const anchors = paths.filter(p => !(scenario === 'unlinked' && p === '/projects/example'))
        .map(p => '<a href="' + p + '">Shed planning ' + p + '</a>').join('');
      const canonical = affected && scenario === 'wrong-canonical'
        ? canonicalOrigin + '/gallery' : canonicalOrigin + url.pathname;
      const html = '<html><head><link rel="canonical" href="' + canonical + '">' +
        (affected && scenario === 'noindex' ? '<meta name="robots" content="noindex, follow">' : '') +
        '</head><body>' + anchors + '</body></html>';
      return { ok: true, status: 200, url: url.href,
        redirected: affected && scenario === 'redirect',
        headers: new Headers({ 'content-type': 'text/html' }), text: async () => html };
    };
    await import(${JSON.stringify(crawlerUrl)});
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', fixture], {
    encoding: 'utf8', timeout: 15000,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}

describe('sitemap crawler CLI', () => {
  it('accepts reachable canonical pages when a local build declares public URLs', () => {
    const result = runCrawler();
    expect(result.status).toBe(0);
    expect(result.output).toContain('Validated 9/9 sitemap pages');
  });

  it.each([
    ['unlinked', 'Sitemap page was not reached'],
    ['wrong-canonical', 'mismatched canonical'],
    ['noindex', 'Sitemap page has a noindex directive'],
    ['redirect', 'Sitemap page redirects'],
  ])('fails the audit for %s project pages', (scenario, message) => {
    const result = runCrawler(scenario);
    expect(result.status).toBe(1);
    expect(result.output).toContain(message);
  });
});
