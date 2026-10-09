import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Layout from './layout';
import { useStore } from './store';
import { get } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Orders from './pages/Orders';
import Payments from './pages/Payments';
import Users from './pages/Users';
import Referrals from './pages/Referrals';
import Broadcast from './pages/Broadcast';
import Settings from './pages/Settings';
import AdminsAudit from './pages/AdminsAudit';

const qc = new QueryClient();

function Guard({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const admin = useStore((s) => s.admin);
  const setAdmin = useStore((s) => s.setAdmin);
  const [loading, setLoading] = useState(!admin);
  useEffect(() => {
    if (admin) return;
    if (!localStorage.getItem('tz_access')) { setLoading(false); return; }
    get('/api/auth/me')
      .then((me) => setAdmin(me as never))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [admin, setAdmin]);
  if (loading) return <div className="p-8 text-sm">Loading…</div>;
  if (!useStore.getState().admin) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(useStore.getState().admin!.role)) {
    return <div className="p-8"><h1 className="text-2xl font-extrabold">403</h1><p className="text-sm">Forbidden for role {useStore.getState().admin!.role}.</p></div>;
  }
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/users" element={<Users />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/broadcast" element={<Broadcast />} />
            <Route path="/settings" element={<Guard roles={['SUPER_ADMIN', 'MANAGER']}><Settings /></Guard>} />
            <Route path="/admins" element={<AdminsAudit />} />
          </Route>
          <Route path="*" element={<div className="p-8"><h1 className="text-2xl font-extrabold">404</h1><p className="text-sm">Page not found. <a href="/" className="underline">Dashboard</a></p></div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
