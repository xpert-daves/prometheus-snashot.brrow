import Link from 'next/link';
import { CalendarCheck2, House, ShieldCheck } from 'lucide-react';
import { SOCIAL_LINKS } from '@/lib/contact';
import { FacebookBadgeIcon, GoogleBadgeIcon } from './BrandIcons';

export default function TrustBadges() {
  const badges = [
    {
      label: 'Facebook Reviews',
      href: SOCIAL_LINKS.facebook,
      icon: FacebookBadgeIcon,
      color: '#1877F2',
    },
    {
      label: 'Google Reviews',
      href: SOCIAL_LINKS.google,
      icon: GoogleBadgeIcon,
      color: '#EA4335',
    },
    {
      label: '20 yrs',
      href: '#why-buy',
      icon: CalendarCheck2,
      color: '#FBBF24',
    },
    {
      label: 'Locally Owned',
      href: '#why-buy',
      icon: House,
      color: '#10B981',
    },
    {
      label: 'Warranties',
      href: '#why-buy',
      icon: ShieldCheck,
      color: '#3B82F6',
    },
  ];
  return (
    <ul className="flex flex-wrap justify-center gap-2 mb-4">
      {badges.map((b) => (
        <li key={b.label}>
          <Link
            href={b.href}
            target={b.href.startsWith('http') ? '_blank' : undefined}
            rel={b.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="brand-label inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[0.68rem] text-white backdrop-blur-sm transition hover:bg-white/10">
            <b.icon size={14} style={{ color: b.color }} />
            <span>{b.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
