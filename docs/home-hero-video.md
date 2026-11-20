# Home Hero Video

The home page uses two separate video paths: a lightweight decorative background loop and a user-invoked full build video.

## Background Loop

The default sources are:

- `public/hero-background.webm` (VP9)
- `public/hero-background.mp4` (H.264 fallback)

Both files are 1280x720, about 10 seconds long, under 2 MB, and contain no audio stream. Keep future background replacements between 10 and 20 seconds, at or below 720p, below 3 MB per format, and explicitly strip audio during encoding.

`public/herobackground.webp` remains the priority hero image and is also the video `poster`. The component does not attach either video source until the poster has loaded, the window load event has completed, two animation frames have passed, and the browser is idle. This keeps the poster as the LCP candidate instead of the video.

The background loop is not attached for reduced-motion visitors, data-saver users, or very slow connections. Once mounted, it pauses when the hero leaves the viewport, the document is hidden, or the full video lightbox is open. Playback resumes only when those conditions clear. A load or autoplay failure leaves the poster visible.

To override the paired sources, set both variables and restart `pnpm dev`:

```bash
NEXT_PUBLIC_HERO_VIDEO_WEBM_SRC=/path/to/background.webm
NEXT_PUBLIC_HERO_VIDEO_MP4_SRC=/path/to/background.mp4
```

`NEXT_PUBLIC_HERO_VIDEO_SRC` remains as a legacy single-format override. New deployments should use the paired variables so every browser has a fallback.

## Full Build Video

"Watch a shed built in one day" opens a keyboard-accessible lightbox and lazy-mounts
the self-hosted `public/shed-build-day.mp4`. The native player uses `playsInline`,
controls, and an H.264 MP4 so it works directly in iPhone Safari without a Facebook
iframe, mobile redirect, third-party cookies, or app/login handoff. The file is not
requested during the initial page load.

The checked-in video is Facebook's progressive rendition of the Shed210 build-day
video: 848x480, about 38 seconds, approximately 2.5 MB, H.264, fast-start, and
silent. If the original master is available, prefer replacing this file with a
higher-quality H.264/AAC MP4 while keeping it reasonably compressed and with the
metadata atom before the media data. Keep the same filename to avoid a deployment
configuration change.

Set `NEXT_PUBLIC_HERO_FULL_VIDEO_SRC` to replace the default path. If that variable
points to another host, allow only that host in the `media-src` content-security
policy in `next.config.ts` and verify the Vercel Preview before shipping. The
Facebook page is retained only as a visible backup link if native playback fails.
