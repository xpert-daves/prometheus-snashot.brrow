# Size chip layout note

The preset size buttons are laid out using flexbox. The container uses
`flex-wrap` so chips wrap naturally on small screens. A responsive utility
`min-[460px]:flex-nowrap` keeps them in a single row once the card reaches
460&nbsp;px, which matches the design spec. `order-last` is applied to the
Custom Size button so it stays visually last regardless of future presets.
Spacing relies on Tailwind's `gap-2` with an extra `min-[460px]:ml-3` on the
Custom Size button for wider layouts.
