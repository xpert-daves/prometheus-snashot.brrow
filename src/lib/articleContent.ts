import type { Heading } from "@/components/TableOfContents";

const ATTR_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)\s*\{([^}]+)\}/g;

export type ArticleFaqItem = {
  question: string;
  answer: string;
};

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeHref(url: string) {
  const normalized = url.trim().toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("sms:") ||
    normalized.startsWith("tel:") ||
    normalized.startsWith("/") ||
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    normalized.startsWith("#") ||
    normalized.startsWith("?")
  );
}

export function preprocessArticleSource(input: string) {
  return input.replace(ATTR_LINK_RE, (_match, text, href, attrs) => {
    const classes = String(attrs)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => (token.startsWith(".") ? token.slice(1) : ""))
      .map((token) => token.replace(/[^a-zA-Z0-9_-]/g, ""))
      .filter(Boolean)
      .join(" ");
    const classAttr = classes ? ` className="${classes}"` : "";
    const safeHref = isSafeHref(String(href)) ? escapeHtml(String(href)) : "";
    const safeText = escapeHtml(String(text));

    if (!safeHref) return safeText;
    return `<a href="${safeHref}"${classAttr}>${safeText}</a>`;
  });
}

function stripMarkdownSyntax(input: string) {
  return input
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~>#]/g, "")
    .trim();
}

function markdownToPlainText(input: string) {
  return stripMarkdownSyntax(
    input
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/\{[^}]*\}/g, " ")
      .replace(/^\s*[-+]\s+/gm, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractArticleFaqItems(source: string): ArticleFaqItem[] {
  const items: ArticleFaqItem[] = [];
  let inFaqSection = false;
  let question = "";
  let answerLines: string[] = [];

  const flushItem = () => {
    const answer = markdownToPlainText(answerLines.join(" "));
    if (question && answer) {
      items.push({ question, answer });
    }
    question = "";
    answerLines = [];
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const h2 = line.match(/^##\s+(.+)$/);

    if (h2) {
      if (inFaqSection) {
        flushItem();
        break;
      }

      const heading = markdownToPlainText(h2[1]);
      inFaqSection = /\bfaqs?\b/i.test(heading);
      continue;
    }

    if (!inFaqSection) continue;

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flushItem();
      question = markdownToPlainText(h3[1]);
      continue;
    }

    if (question && line) {
      answerLines.push(line);
    }
  }

  if (inFaqSection) {
    flushItem();
  }

  return items;
}

export function createHeadingIdFactory() {
  const used = new Set<string>();

  return (text: string) => {
    const base = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    if (!used.has(base)) {
      used.add(base);
      return base;
    }

    let suffix = 1;
    let nextId = `${base}-${suffix}`;
    while (used.has(nextId)) {
      suffix += 1;
      nextId = `${base}-${suffix}`;
    }
    used.add(nextId);
    return nextId;
  };
}

export function extractArticleHeadings(source: string): Heading[] {
  const makeId = createHeadingIdFactory();
  const headings: Heading[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      const text = stripMarkdownSyntax(line.slice(3));
      if (text) headings.push({ id: makeId(text), text, level: 2 });
      continue;
    }

    if (line.startsWith("### ")) {
      const text = stripMarkdownSyntax(line.slice(4));
      if (text) headings.push({ id: makeId(text), text, level: 3 });
    }
  }

  return headings;
}
