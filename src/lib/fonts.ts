import { Alfa_Slab_One, IBM_Plex_Mono, Inter, Oswald } from 'next/font/google';

export const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const alfaSlab = Alfa_Slab_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-alfa-slab',
  display: 'swap',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});
