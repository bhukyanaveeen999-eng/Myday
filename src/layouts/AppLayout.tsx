import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Settings,
  Bell,
  BellOff,
  LogOut,
  Menu,
  X,
  Calendar,
  Download,
  WifiOff,
} from 'lucide-react';
import { useSupabaseConnection } from '../hooks/useSupabaseConnection';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useReminders } from '../context/ReminderContext';
import { updateAppState } from '../utils/appStateStorage';

export const AppLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const connection = useSupabaseConnection();
  const { canInstall, promptInstall, isOnline } = usePwaInstall();
  const { preferences, activeQueue } = useReminders();

  // Persist last visited section so closing and reopening MyDay returns where the user left off
  useEffect(() => {
    if (user?.id) {
      const fullPath = `${location.pathname}${location.search || ''}`;
      updateAppState(user.id, { lastRoute: fullPath });
    }
  }, [user?.id, location.pathname, location.search]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Tasks', to: '/tasks', icon: CheckSquare },
    { name: 'Notes', to: '/notes', icon: FileText },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-slate-800 text-white px-4 py-1.5 text-xs text-center flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>You are offline. Cached app shell is active; local note drafts are still saved on this device.</span>
        </div>
      )}

      {/* Top Warning Banner if Supabase is unconfigured or unreachable while online */}
      {isOnline && (!connection.isConfigured || connection.isReachable === false) && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 text-center font-medium">
          {!connection.isConfigured
            ? 'Supabase credentials are not configured in .env. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
            : `Supabase connection warning: ${connection.error || 'Unable to reach Supabase Auth endpoint.'}`}
        </div>
      )}

      {/* Main Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <NavLink to="/dashboard" className="flex items-center gap-2 text-blue-600 font-bold text-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span>MyDay</span>
              </NavLink>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex ml-8 space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Desktop User Section */}
            <div className="hidden md:flex items-center gap-3">
              <NavLink
                to="/settings"
                title={
                  preferences.enabled
                    ? `Reminders active (${preferences.mode})`
                    : 'Reminders paused'
                }
                className="relative p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                aria-label="Notification settings"
              >
                {preferences.enabled ? (
                  <Bell className="w-4 h-4 text-blue-600" />
                ) : (
                  <BellOff className="w-4 h-4 text-gray-400" />
                )}
                {activeQueue.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </NavLink>
              {canInstall && (
                <button
                  type="button"
                  onClick={promptInstall}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                  title="Install MyDay app"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Install App
                </button>
              )}
              <span className="text-xs text-gray-500 max-w-[220px] truncate" title={user?.email}>
                {user?.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Log out
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-1.5">
              {canInstall && (
                <button
                  type="button"
                  onClick={promptInstall}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded"
                  title="Install MyDay app"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Install
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-2 pb-3 space-y-1">
            <div className="px-3 py-1 mb-2 text-xs text-gray-500 border-b border-gray-100 truncate">
              Signed in as: <span className="font-semibold">{user?.email}</span>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 rounded-md text-base font-medium ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </NavLink>
              );
            })}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Log out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area — keyed by user?.id so switching accounts never leaks in-memory state */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet key={user?.id} />
      </main>

      {/* Mobile Bottom Navigation Bar for Android / Touch devices */}
      <nav className="md:hidden bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-30 flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center text-xs font-medium px-3 py-1 ${
                  isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
