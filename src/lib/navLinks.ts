export type NavLink = {
  href: string;
  label: string;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/buildings", label: "Buildings" },
  { href: "/gallery", label: "Gallery" },
  { href: "/service-area", label: "Service Areas" },
  { href: "/news", label: "Guides" },
  { href: "/contact", label: "Contact" },
];

export function isNavLinkActive(
  pathname: string | null,
  href: string
): boolean {
  if (!pathname) return false;
  if (href === "/gallery" && pathname.startsWith("/projects/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
