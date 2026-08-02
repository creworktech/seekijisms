import React, { useState } from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { hasPermission } from '../utils/formatters';
import seekojiLogo from '../../../public/images/logo.png';

export default function AppLayout({ children, title = 'Dashboard', description = 'Seekoji Electric Service Management Portal' }) {
  const { auth, flash } = usePage().props;
  const user = auth?.user;

  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(
    flash?.success
      ? { type: 'success', message: flash.success }
      : flash?.error
      ? { type: 'error', message: flash.error }
      : null
  );

  React.useEffect(() => {
    if (flash?.success) {
      setToast({ type: 'success', message: flash.success });
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    } else if (flash?.error) {
      setToast({ type: 'error', message: flash.error });
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  React.useEffect(() => {
    const handleToastEvent = (e) => {
      if (e.detail?.message) {
        setToast({
          type: e.detail.type || 'success',
          message: e.detail.message,
        });
        const timer = setTimeout(() => setToast(null), 5000);
      }
    };

    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, []);

  const currentPath = window.location.pathname;

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard', show: true },
    { label: 'Job Control Center', href: '/jcc', icon: 'bolt', show: user?.roles?.includes('admin') },
    { label: 'All Jobs', href: '/jobs', icon: 'format_list_bulleted', show: hasPermission(user, 'jobs.view') },
    { label: 'Delivery', href: '/delivery', icon: 'local_shipping', show: hasPermission(user, 'jobs.view') },
    { label: 'Customers', href: '/customers', icon: 'groups', show: hasPermission(user, 'customers.view') },
    { label: 'Accounts', href: '/accounts', icon: 'account_balance_wallet', show: user?.roles?.includes('admin') || hasPermission(user, 'reports.view') },
    { label: 'Reports', href: '/reports', icon: 'analytics', show: hasPermission(user, 'reports.view') },
    { label: 'Users', href: '/users', icon: 'group_add', show: hasPermission(user, 'users.manage') },
    { label: 'Settings', href: '/settings', icon: 'settings', show: hasPermission(user, 'settings.manage') },
  ];

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.get('/jobs', { search: searchQuery.trim() });
  };

  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'US';

  return (
    <div className="min-h-screen flex bg-[#f9f9f7] text-[#1a1c1b] font-sans antialiased max-w-full overflow-x-hidden">
      <Head>
        <title>{`${title} | Seekoji Service Management`}</title>
        <meta name="description" content={description} />
      </Head>

      {/* Toast Alert System */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2.5 text-white ${
              toast.type === 'error'
                ? 'bg-rose-600 border border-rose-400'
                : 'bg-[#1a1c1b] border border-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-lg">
              {toast.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 cursor-pointer">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SIDEBAR */}
      <aside className="fixed left-0 top-0 h-screen w-[250px] bg-white border-r border-[#E5E5E5] flex flex-col py-4 z-50">

        {/* BRAND */}
        <div className="px-6 mb-6 flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-2.5">
            <img src={seekojiLogo} alt="Seekoji Logo" className="h-9 w-auto object-contain shrink-0" />
            {/* <h1 className="text-lg font-bold text-[#005ea4] leading-tight">Seekoji</h1> */}
          </div>
          <p className="text-[11px] text-[#666666] uppercase font-bold tracking-wider">
            Service Management
          </p>
        </div>

        {/* NAV LINKS */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 hide-sb">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-lg text-xs transition-colors ${isActive
                    ? 'bg-[#F0F7FF] text-[#005ea4] font-semibold border-l-4 border-[#005ea4] pl-2'
                    : 'text-[#666666] hover:bg-[#f4f4f2] hover:text-[#0b0b0b]'
                    }`}
                >
                  <span className="material-symbols-outlined mr-3 text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>

        {/* NAV FOOTER (LOGOUT) */}
        <div className="px-2 pt-3 mt-auto border-t border-[#E5E5E5]">
          <button
            onClick={() => router.post('/logout')}
            className="w-full flex items-center px-3 py-2 rounded-lg text-xs text-[#D03B3B] hover:bg-rose-50 transition-colors font-medium cursor-pointer"
          >
            <span className="material-symbols-outlined mr-3 text-lg">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="ml-[250px] flex-1 w-[calc(100vw-250px)] max-w-[calc(100vw-250px)] min-h-screen flex flex-col overflow-x-hidden">

        {/* TOPBAR */}
        <header className="bg-white border-b border-[#E5E5E5] flex justify-between items-center px-4 py-2.5 shrink-0 gap-4 sticky top-0 z-40">
          <h2 className="text-xl font-semibold text-[#0B0B0B]">
            {title}
          </h2>

          <div className="flex items-center gap-4">

            {/* Global Search */}
            <form onSubmit={handleGlobalSearch} className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#717783] text-lg pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder="Search Token No, Customer or Job ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-3 py-1.5 bg-[#f4f4f2] border border-[#E5E5E5] rounded-lg w-72 text-xs outline-none focus:border-[#005ea4] focus:ring-1 focus:ring-[#005ea4] transition-all"
              />
            </form>

            {/* Notification Bell */}
            <button className="text-[#666666] hover:text-[#005ea4] transition-colors p-1" title="Notifications">
              <span className="material-symbols-outlined text-xl">notifications</span>
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2.5 pl-4 border-l border-[#E5E5E5]">
              <div className="w-8 h-8 rounded-full bg-[#005ea4] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {userInitials}
              </div>
              <div className="leading-tight">
                <b className="block text-xs text-[#0B0B0B]">{user?.name || 'Staff User'}</b>
                <small className="text-[10px] text-[#666666] capitalize">
                  {user?.roles?.[0] ? user.roles[0].replace('_', ' ') : 'User'}
                </small>
              </div>
            </div>

          </div>
        </header>

        {/* PAGE VIEW */}
        <main className="flex-1 overflow-y-auto thin-sb">
          {children}
        </main>

      </div>
    </div>
  );
}
