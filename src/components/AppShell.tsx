"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, BookOpen, Database, FlaskConical, FlaskRound, Gauge, LayoutDashboard, Menu, MonitorPlay, Search, Swords, Trophy, X, FileText } from "lucide-react";
import { api } from "@/lib/client/api";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/algorithms", label: "Algorithm Lab", icon: FlaskConical },
  { href: "/visualizer", label: "Visualizer", icon: MonitorPlay },
  { href: "/benchmark", label: "Benchmark Lab", icon: Gauge },
  { href: "/datasets", label: "Dataset Lab", icon: Database },
  { href: "/experiments", label: "Experiments", icon: FileText },
  { href: "/learning", label: "Learning Lab", icon: BookOpen },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/research", label: "Research", icon: BarChart3 },
];

const SEARCH_ALGOS = [
  ["naive", "Naive String Matching"],
  ["kmp", "Knuth–Morris–Pratt (KMP)"],
  ["rabin-karp", "Rabin–Karp"],
  ["boyer-moore", "Boyer–Moore"],
  ["aho-corasick", "Aho–Corasick"],
  ["trie", "Trie"],
  ["suffix-array", "Suffix Array"],
  ["kasai", "Kasai LCP"],
  ["edit-distance", "Edit Distance"],
  ["tfidf", "TF-IDF"],
  ["inverted-index", "Inverted Index"],
  ["similarity", "Text Similarity"],
];

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const r: { label: string; sub: string; href: string }[] = [];
    for (const [id, name] of SEARCH_ALGOS)
      if (name.toLowerCase().includes(s) || id.includes(s)) {
        r.push({ label: name, sub: "Run in Algorithm Lab", href: `/algorithms?algo=${id}` });
        r.push({ label: name, sub: "Visualize step-by-step", href: `/visualizer?algo=${id}` });
        r.push({ label: name, sub: "Learn", href: `/learning?algo=${id}` });
      }
    for (const n of NAV) if (n.label.toLowerCase().includes(s)) r.push({ label: n.label, sub: "Page", href: n.href });
    return r.slice(0, 9);
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            router.push(results[0].href);
            setOpen(false);
            setQ("");
          }
        }}
        placeholder="Search algorithms or pages…"
        aria-label="Search"
        className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          {results.map((r, i) => (
            <Link key={i} href={r.href} onClick={() => { setOpen(false); setQ(""); }} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-indigo-50">
              <span className="text-slate-800">{r.label}</span>
              <span className="text-xs text-slate-500">{r.sub}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ApiStatus() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const r = await api<{ ok: boolean }>("/api/health");
      if (alive) setOk(!!r.data?.ok);
    };
    check();
    const t = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <div className="hidden items-center gap-1.5 text-xs text-slate-600 sm:flex" title="Backend / database health">
      <span className={`h-2 w-2 rounded-full ${ok === null ? "bg-slate-300" : ok ? "bg-green-500" : "bg-red-500"}`} />
      {ok === null ? "Checking API" : ok ? "API online" : "API offline"}
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (pathname.startsWith("/reports/")) return <>{children}</>;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workspace</p>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium ${isActive(n.href) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
          <n.icon className="h-4 w-4" />
          {n.label}
        </Link>
      ))}
      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
        <Swords className="mb-1 h-4 w-4 text-slate-400" />
        Tip: use <b>Benchmark Lab → Battle</b> to compare algorithms on the same input with real measurements.
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
        <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
            <FlaskRound className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Algorithm Laboratory</span>
        </Link>
        <div className="flex flex-1 justify-center px-2">
          <GlobalSearch />
        </div>
        <ApiStatus />
      </header>
      <aside className="fixed bottom-0 left-0 top-14 hidden w-60 overflow-y-auto border-r border-slate-200 bg-white lg:block">{nav}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute bottom-0 left-0 top-0 w-64 overflow-y-auto bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="font-semibold">Navigation</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
