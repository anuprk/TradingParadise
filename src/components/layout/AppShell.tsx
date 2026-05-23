import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import Toast from '../ui/Toast';

export default function AppShell() {
  return (
    <div className="h-screen flex flex-col bg-surface-primary">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 text-text-primary">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}
