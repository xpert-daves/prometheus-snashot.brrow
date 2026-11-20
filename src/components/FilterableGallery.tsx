"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import GalleryGrid from "./GalleryGrid"
import { portfolioProjects } from "@/lib/portfolio"

export default function FilterableGallery() {
  const allItems = portfolioProjects
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allItems
    return allItems.filter((it) =>
      [
        it.alt,
        it.caption,
        it.city,
        it.projectType,
        it.size,
        it.useCase,
        it.areaNote,
        ...it.features,
      ]
        .filter(Boolean)
        .some((t) => (t as string).toLowerCase().includes(q))
    )
  }, [allItems, query])

  // announce counts for screen readers
  const [announce, setAnnounce] = useState("")
  useEffect(() => {
    setAnnounce(`${filtered.length} result${filtered.length === 1 ? "" : "s"} shown`)
  }, [filtered.length])

  return (
    <div>
      {/* Search bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-2 text-white shadow-inner backdrop-blur-sm transition focus-within:border-amber-400/35 focus-within:ring-2 focus-within:ring-amber-400/10">
        <Search className="h-4 w-4 text-[var(--accent-light)]" aria-hidden="true" />
        <label htmlFor="gallery-search" className="sr-only">Search gallery</label>
        <input
          id="gallery-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by style, color, caption..."
          className="mb-0 flex-1 bg-transparent px-0 py-2 text-sm placeholder:text-white/60 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="grid h-8 w-8 place-content-center rounded-full bg-white/[0.07] text-white/65 hover:bg-white/12 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Announce result count */}
      <p className="sr-only" aria-live="polite">{announce}</p>

      {/* Grid */}
      <div className="mt-4" id="gallery-grid">
        <GalleryGrid items={filtered} />
      </div>
    </div>
  )
}
