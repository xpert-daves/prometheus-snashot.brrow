#!/usr/bin/env node
/*
  Create a new article Markdown/MDX file with frontmatter.
  Usage:
    pnpm new:article "My Post Title" [--slug custom-slug] [--date 2025-09-02] [--hero /images/hero.jpg] [--tags tips,backyard]
*/

const fs = require('fs');
const path = require('path');

function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug') args.slug = argv[++i];
    else if (a === '--date') args.date = argv[++i];
    else if (a === '--hero') args.hero = argv[++i];
    else if (a === '--tags') args.tags = argv[++i];
    else if (a.startsWith('--')) {
      // ignore unknown
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const title = args._.join(' ').trim();
  if (!title) {
    console.error('Usage: pnpm new:article "My Post Title" [--slug custom-slug] [--date YYYY-MM-DD] [--hero /img.jpg] [--tags tips,backyard]');
    process.exit(1);
  }

  const slug = args.slug ? slugify(args.slug) : slugify(title);
  const date = args.date || new Date().toISOString().split('T')[0];
  const hero = args.hero || '';
  const tags = args.tags ? args.tags : '';

  const articlesDir = path.join(process.cwd(), 'src', 'articles');
  const file = path.join(articlesDir, `${slug}.mdx`);

  if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
  }
  if (fs.existsSync(file)) {
    console.error(`File already exists: ${path.relative(process.cwd(), file)}`);
    process.exit(1);
  }

  const fm = [
    '---',
    `title: ${title}`,
    'excerpt: Write a short one-liner for the card.',
    `date: ${date}`,
    hero ? `hero: ${hero}` : undefined,
    tags ? `tags: ${tags}` : undefined,
    '---',
    '',
  ].filter(Boolean).join('\n');

  const body = `## Introduction\n\nWrite a friendly intro paragraph here.\n\n## Key Points\n\n- First helpful takeaway\n- Second helpful takeaway\n\n## Conclusion\n\nWrap up with a clear call-to-action or next steps.\n`;

  fs.writeFileSync(file, fm + body, 'utf8');
  console.log(`Created: ${path.relative(process.cwd(), file)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
