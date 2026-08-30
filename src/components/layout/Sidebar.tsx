import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Bell,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  Target,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { usePlanStore } from '../../stores/planStore';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/positions', label: 'Positions', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/plans', label: 'Plans', icon: FileText },
  { to: '/portfolios', label: 'Portfolios', icon: Briefcase },
  { to: '/daily-notes', label: 'Notes', icon: StickyNote },
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
  const { activePlanId, setActivePlanId } = useAppStore();
  const { plans, loadPlans } = usePlanStore();

  useEffect(() => { loadPlans(); }, [loadPlans]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:flex-col border-r border-border bg-surface-secondary shrink-0 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {/* Plan Selector */}
        {!collapsed && plans.length > 0 && (
          <div className="p-2 border-b border-border">
            <label htmlFor="sidebar-plan-select" className="text-[10px] text-text-secondary uppercase font-medium px-1">Plan</label>
            <select
              id="sidebar-plan-select"
              aria-label="Select trading plan"
              value={activePlanId ?? ''}
              onChange={(e) => setActivePlanId(e.target.value || null)}
              className="w-full mt-1 px-2 py-1.5 text-xs rounded border border-border bg-input-bg text-text-primary truncate"
            >
              <option value="">Select Plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        {collapsed && activePlanId && (
          <div className="p-1 border-b border-border text-center" title={plans.find((p) => p.id === activePlanId)?.name}>
            <span className="text-[9px] text-text-accent font-bold">
              {(plans.find((p) => p.id === activePlanId)?.name ?? '').slice(0, 3).toUpperCase()}
            </span>
          </div>
        )}

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
          {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
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
