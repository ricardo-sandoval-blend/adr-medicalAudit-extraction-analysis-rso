'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BarChart3, Zap, BookOpen } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const links = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: BarChart3,
    },
    {
      href: '/executor',
      label: 'Executor',
      icon: Zap,
    },
    {
      href: '/changelog',
      label: 'Changelog',
      icon: BookOpen,
    },
  ];

  return (
    <nav className="border-b bg-background">
      <div className="px-6 py-3 flex items-center gap-8">
        <Link href="/" className="font-bold text-lg">
          ADR Extraction
        </Link>

        <div className="flex gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
