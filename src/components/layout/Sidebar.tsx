import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Bell,
  StickyNote,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/plans', label: 'Plans', icon: FileText },
  { to: '/portfolios', label: 'Portfolios', icon: Briefcase },
  { to: '/daily-notes', label: 'Daily Notes', icon: StickyNote },
  { to: '/reminders', label: 'Reminders', icon: Bell },
];

function linkClass({ isActive }: { isActive: boolean }, collapsed: boolean) {
  const base = collapsed
    ? 'flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors'
    : 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
  return isActive
    ? `${base} bg-surface-tertiary text-text-accent`
    : `${base} text-text-secondary hover:bg-surface-tertiary hover:text-text-primary`;
}

function mobileLinkClass({ isActive }: { isActive: boolean }) {
  const base =
    'flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors py-1 px-2';
  return isActive ? `${base} text-text-accent` : `${base} text-text-secondary`;
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:flex-col border-r border-border bg-surface-secondary shrink-0 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={(props) => linkClass(props, collapsed)}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center p-2 m-2 rounded-lg text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-surface-secondary border-t border-border z-40"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-around items-center h-14">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={mobileLinkClass}>
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
