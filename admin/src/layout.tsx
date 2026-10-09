import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Package, FolderOpen, ReceiptText, CreditCard, Users,
  Gift, Megaphone, Settings as SettingsIcon, ShieldCheck, Menu, X,
  Sun, Moon, LogOut, Store, ChevronLeft,
} from 'lucide-react';
import { useStore } from './store';
import { ToastHost } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/products', label: 'Category Product', Icon: Package },
  { to: '/categories', label: 'Categories', Icon: FolderOpen },
  { to: '/orders', label: 'Orders', Icon: ReceiptText },
  { to: '/payments', label: 'Payments', Icon: CreditCard },
  { to: '/users', label: 'Users', Icon: Users },
  { to: '/referrals', label: 'Referrals', Icon: Gift },
  { to: '/broadcast', label: 'Broadcast', Icon: Megaphone },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
  { to: '/admins', label: 'Admins & Audit', Icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
] as const;

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="mb-6 flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black tracking-tight text-white shadow-sm">
        TZ
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold tracking-tight">TZ Store</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Admin</span>
        </span>
      )}
    </Link>
  );
}

function NavList({ onNav }: { onNav?: () => void }) {
  const { admin } = useStore();
  const visible = NAV.filter((n) => !('roles' in n && (n as unknown as { roles: string[] }).roles) || (admin && ((n as unknown as { roles: string[] }).roles.includes(admin.role))));
  return (
    <nav className="space-y-1">
      {visible.map((n) => (
        <NavLink key={n.to} to={n.to} onClick={onNav}
          className={({ isActive }) => `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
          <n.Icon size={17} strokeWidth={2.2} />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { admin, theme, toggleTheme, sidebar, toggleSidebar } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen">
      {sidebar && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800 md:block">
          <Logo />
          <NavList />
          <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60">
            <div className="font-semibold text-slate-700 dark:text-slate-200">Live products</div>
            <div className="mt-0.5">Product pages read from the current database.</div>
          </div>
        </aside>
      )}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-white p-4 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-xs font-black text-white">TZ</span>
                <span className="text-base font-extrabold">TZ Store <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Admin</span></span>
              </span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded-lg px-2.5 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            <NavList onNav={() => setMobileOpen(false)} />
            <a href={(import.meta as unknown as { env: Record<string, string> }).env?.VITE_STORE_URL ?? 'http://localhost:3000/home'}
              target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"><Store size={17} /> View Store</a>
          </aside>
        </div>
      )}
      <div className={`flex-1 ${sidebar ? 'md:pl-60' : ''}`}>
        <header className="sticky top-0 z-30 flex items-center gap-2 bg-white/90 px-4 py-3 backdrop-blur dark:bg-slate-900/90">
          <button onClick={() => { if (window.matchMedia('(max-width: 767px)').matches) setMobileOpen(true); else toggleSidebar(); }} aria-label="Toggle menu" className="rounded-lg px-2.5 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800">
            {sidebar ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
          <div className="font-bold md:hidden">TZ Admin</div>
          <div className="flex-1" />
          <a href={(import.meta as unknown as { env: Record<string, string> }).env?.VITE_STORE_URL ?? 'http://localhost:3000/home'}
            target="_blank" rel="noreferrer" title="Open user storefront"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-200 dark:hover:bg-slate-800"><Store size={16} /> <span className="hidden sm:inline">Store</span></a>
          <button onClick={toggleTheme} title="Theme" aria-label="Toggle theme" className="rounded-lg px-2.5 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800">{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">{admin?.email?.[0]?.toUpperCase()}</span>
            <div className="hidden text-xs leading-tight sm:block">
              <div className="font-semibold">{admin?.email}</div>
              <div className="text-slate-500">{admin?.role}</div>
            </div>
            <button
              onClick={() => { localStorage.removeItem('tz_access'); localStorage.removeItem('tz_refresh'); nav('/login'); }}
              title="Sign out" aria-label="Sign out"
              className="rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-200 dark:hover:bg-slate-800"><LogOut size={17} /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4"><Outlet /></main>
      </div>
      <ToastHost />
    </div>
  );
}
