"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Menu, X } from "lucide-react";
import { NAV_ICONS, type NavGroup } from "@/components/console/sidebar";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/consola" && pathname.startsWith(href));
}

interface TabItem {
  href: string;
  label: string;
  icon?: string;
  badge?: number;
}

export function MobileTabBar({
  groups,
  clinicSlug,
}: {
  groups: NavGroup[];
  clinicSlug: string;
}) {
  const pathname = usePathname();
  const [masAbierto, setMasAbierto] = useState(false);

  const tabs: TabItem[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      if (item.children && item.children.length > 0) continue;
      if (!item.href) continue;
      if (tabs.length >= 4) break;
      tabs.push({ href: item.href, label: item.label, icon: item.icon, badge: item.badge });
    }
    if (tabs.length >= 4) break;
  }

  const enTab = tabs.some((t) => isActivePath(pathname, t.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navegación principal"
      >
        <div className="grid grid-cols-5">
          {tabs.map((t) => {
            const activo = isActivePath(pathname, t.href);
            const Icon = t.icon ? NAV_ICONS[t.icon] : undefined;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] leading-tight transition-colors",
                  activo ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-x-4 top-0 h-0.5 rounded-full transition-colors",
                    activo ? "bg-primary" : "bg-transparent",
                  )}
                />
                <span className="relative">
                  {Icon ? <Icon className="size-5" /> : null}
                  {t.badge ? (
                    <span className="absolute -right-2.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold leading-none text-amber-950">
                      {t.badge > 9 ? "9+" : t.badge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate px-1">{t.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMasAbierto(true)}
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] leading-tight transition-colors",
              !enTab ? "font-semibold text-primary" : "text-muted-foreground",
            )}
            aria-label="Más opciones"
          >
            <span
              className={cn(
                "absolute inset-x-4 top-0 h-0.5 rounded-full transition-colors",
                !enTab ? "bg-primary" : "bg-transparent",
              )}
            />
            <Menu className="size-5" />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {masAbierto ? (
        <MobileMoreSheet
          groups={groups}
          clinicSlug={clinicSlug}
          pathname={pathname}
          onClose={() => setMasAbierto(false)}
        />
      ) : null}
    </>
  );
}

function MobileMoreSheet({
  groups,
  clinicSlug,
  pathname,
  onClose,
}: {
  groups: NavGroup[];
  clinicSlug: string;
  pathname: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)] shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-4 py-3">
          <p className="text-sm font-semibold">Menú</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 px-3 py-4">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.title}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((item) =>
                  item.children && item.children.length > 0 ? (
                    <li key={item.label}>
                      <p className="px-2 pb-0.5 pt-1.5 text-xs font-medium text-foreground/80">
                        {item.label}
                      </p>
                      <ul className="space-y-0.5">
                        {item.children.map((c) => {
                          const activo = isActivePath(pathname, c.href);
                          return (
                            <li key={c.href}>
                              <Link
                                href={c.href}
                                onClick={onClose}
                                className={cn(
                                  "flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors",
                                  activo
                                    ? "bg-accent font-medium text-accent-foreground"
                                    : "text-foreground/80 hover:bg-accent/60",
                                )}
                              >
                                <span className="flex-1 truncate">{c.label}</span>
                                {c.badge ? (
                                  <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                    {c.badge}
                                  </span>
                                ) : null}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ) : (
                    <li key={item.href ?? item.label}>
                      <Link
                        href={item.href ?? "/consola"}
                        onClick={onClose}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors",
                          item.href && isActivePath(pathname, item.href)
                            ? "bg-accent font-medium text-accent-foreground"
                            : "text-foreground/80 hover:bg-accent/60",
                        )}
                      >
                        {item.icon && NAV_ICONS[item.icon]
                          ? (() => {
                              const key = item.icon;
                              if (!key) return null;
                              const Icon = NAV_ICONS[key];
                              if (!Icon) return null;
                              return (
                                <Icon className="size-4 shrink-0 text-muted-foreground" />
                              );
                            })()
                          : null}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}

          <a
            href={`/${clinicSlug}/reserva`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-2.5 rounded-lg border border-border px-2 text-sm text-foreground/80"
          >
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            Página pública de reservas
          </a>
        </div>
      </div>
    </div>
  );
}
