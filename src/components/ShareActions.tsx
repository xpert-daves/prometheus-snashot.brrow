"use client";

import { useCallback, useMemo, useState } from "react";

type Props = {
  title: string;
  path: string; // stable absolute URL, supplied by the server
  className?: string;
};

export default function ShareActions({ title, path, className }: Props) {
  const [copied, setCopied] = useState(false);
  const url = path;

  const text = useMemo(() => `Check this out: ${title}`, [title]);
  const share = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [text, title, url]);

  const shareUrl = encodeURIComponent(url);
  const shareText = encodeURIComponent(text);

  return (
    <div className={`interior-card p-5 ${className || ""}`}>
      <div className="brand-subheading mb-2 text-sm">Share</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={share}
          className="brand-button inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs hover:border-amber-400/30"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>
          {copied ? "Copied" : "Share / Copy"}
        </button>
        <a
          href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="brand-button inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs hover:border-amber-400/30"
          aria-label="Share on X"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.487 11.24H16.17l-5.3-6.94-6.06 6.94H1.493l7.73-8.85L1 2.25h6.06l4.78 6.27 6.404-6.27Zm-1.16 19.5h1.833L7.01 3.62H5.05l12.034 18.13Z"/></svg>
          X
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="brand-button inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs hover:border-amber-400/30"
          aria-label="Share on Facebook"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.563 9.874v-6.987H7.898V12h2.54V9.797c0-2.506 1.492-3.89 3.775-3.89 1.094 0 2.24.195 2.24.195v2.463h-1.262c-1.243 0-1.63.772-1.63 1.563V12h2.773l-.443 2.887h-2.33v6.987A10.002 10.002 0 0 0 22 12Z"/></svg>
          Facebook
        </a>
        <a
          href={`https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${shareText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="brand-button inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs hover:border-amber-400/30"
          aria-label="Share on LinkedIn"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M6.94 21H3.56V8.6h3.38V21ZM5.25 7.07a1.96 1.96 0 1 1 0-3.92 1.96 1.96 0 0 1 0 3.92ZM21 21h-3.38v-6.39c0-1.52-.03-3.47-2.11-3.47-2.12 0-2.45 1.65-2.45 3.36V21H9.69V8.6h3.24v1.69h.05c.45-.86 1.56-1.77 3.21-1.77 3.43 0 4.06 2.25 4.06 5.17V21Z"/></svg>
          LinkedIn
        </a>
      </div>
    </div>
  );
}
