# Authoring Articles (Guides)

Articles live in `src/articles/` as Markdown or MDX files with YAML frontmatter.

## Quick Start

- Create a post:
  - Command: `pnpm new:article "Your Post Title"`
  - Options:
    - `--slug custom-slug`
    - `--date YYYY-MM-DD` (defaults to today)
    - `--hero /path/to/hero.jpg`
    - `--tags tips,backyard`
- Edit the generated file at `src/articles/<slug>.mdx`.
- Visit `/news` to see your post listed. Click through to view the article page.

## Frontmatter

```
---
title: Your Great Post
excerpt: One-liner shown on the card
date: 2025-09-02
hero: /images/hero.jpg
heroAlt: Descriptive alt text for the hero image
heroLayout: artwork
tags: tips, backyard
---
```

Notes:
- `readingTime` is computed automatically.
- `excerpt` is optional; if omitted, the first paragraph becomes the teaser.
- `heroAlt` is optional but recommended. Describe the image accurately without
  inventing a project location, size, feature, or customer detail.
- Set `heroLayout: artwork` only for approved cover art that already contains
  its own headline. The article and featured-guide pages preserve the full
  16:9 artwork and keep the semantic heading accessible without placing a
  duplicate visible title over the image. Omit `heroLayout` for normal hero
  photography that should use the standard background treatment.

## Content Tips

- Use `#`, `##`, and `###` headings; the ToC picks up `##` and `###`.
- Add images with `![alt](/path.jpg)`; hero images go in frontmatter.
- Links are auto-styled; prefer descriptive link text.
- Text-message CTAs can use `[Text Shed210](sms:+18555780944){ .btn .btn-outline }`.
- Code: inline `` `like-this` `` or fenced blocks:

  ```
  ```js
  console.log('hello')
  ```
  ```

- Tables: GitHub-style tables are supported.

## FAQ Structured Data

Articles automatically emit `FAQPage` JSON-LD when they contain an FAQ section:

- Use a level-two heading containing `FAQ` or `FAQs`, such as `## FAQ: Shed Cost Questions`.
- Write each question as a level-three heading (`### Question?`).
- Put the answer directly below the question. Markdown links and emphasis are converted to plain text in the schema.
- The FAQ section ends at the next level-two heading.

Keep the visible FAQ copy and its structured-data answer identical; the schema is generated from the article source.

## Encoding

- Save files as UTF-8 to avoid garbled characters. In VS Code: bottom-right encoding → “Save with Encoding…” → “UTF-8”.

## Workflow

1. `pnpm new:article "Title"`
2. Update frontmatter fields.
3. Write content using Markdown/MDX.
4. `pnpm lint` and `pnpm test` (optional for content-only changes).
5. Commit and push.
