"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutGrid, Briefcase, History, BarChart2 } from "lucide-react";

const NAV = [
  { href: "/",          Icon: Activity,   label: "Home"      },
  { href: "/overview",  Icon: LayoutGrid, label: "Overview"  },
  { href: "/portfolio", Icon: Briefcase,  label: "Portfolio" },
  { href: "/history",   Icon: History,    label: "Storico"   },
  { href: "/stats",     Icon: BarChart2,  label: "Stats"     },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#070c18]/96 backdrop-blur-md border-t border-[#1a2e48]">
      <div className="flex items-stretch h-14">
        {NAV.map(({ href, Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? "text-blue-400"
                  : "text-slate-600 active:text-slate-400"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.5 : 1.75} />
              <span className={`text-[9px] font-semibold tracking-wide ${active ? "text-blue-400" : "text-slate-600"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-[#070c18]/96" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
    </nav>
  );
}
