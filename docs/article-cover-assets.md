# Shed210 article cover assets

The article covers under `public/article-covers/` use verified Shed210 project
photography. No shed, worker, yard, or construction detail was generated,
outpainted, or replaced by an image-generation model.

## Published assets

| Asset | Article | Source photo | Truth boundary |
| --- | --- | --- | --- |
| `san-antonio-shed-cost-guide.webp` | `san-antonio-shed-cost-guide.mdx` | Finished exterior cover photo from the published July 2026 Lakehills 6x8x7 Shed project | “San Antonio” describes the guide topic; the photographed installation is not presented as a San Antonio project. |
| `san-antonio-shed-permits-hoa-guide.webp` | `sanantonio_shed_guide.md` | Framing-stage photo from the same published Lakehills project | The build-stage image illustrates planning; it does not claim the photographed project required a San Antonio permit or HOA approval. |

The source photos are published on `https://www.shed210.com/gallery` and served
from Shed210's public CRM project-photo endpoint. The production assets apply
only deterministic resizing, crop/placement, tonal grading, typography, brand
colors, and the official Shed210 logo.

Both publication files are 1600 × 900 WebP images with metadata removed. Keep
source-safe `heroAlt` copy in article frontmatter and use `heroLayout: artwork`
so the cover remains intact without a duplicate title overlay.
