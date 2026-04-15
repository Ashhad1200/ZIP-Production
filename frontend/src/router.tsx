import React, { Suspense, useState } from 'react';
import { Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useRole } from './hooks/useRole';
import { Sidebar, Header, MobileNav } from './components/layout';
import { LoadingSpinner } from './components/ui';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { ROLES } from './utils/constants';

// --------------- Lazy-loaded pages ---------------
const LoginPage = React.lazy(() =>
  import('./pages/Login/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = React.lazy(
  () => import('./pages/Dashboard/DashboardPage'),
);
const ProductionPage = React.lazy(
  () => import('./pages/Production/ProductionPage'),
);
const InventoryPage = React.lazy(
  () => import('./pages/Inventory/InventoryPage'),
);
const GatePassPage = React.lazy(
  () => import('./pages/GatePass/GatePassPage'),
);
const VerifyGatePassPage = React.lazy(() =>
  import('./pages/GatePass/VerifyGatePass').then((m) => ({ default: m.VerifyGatePass })),
);
const SalesReturnPage = React.lazy(() =>
  import('./pages/GatePass/SalesReturnPage').then((m) => ({ default: m.SalesReturnPage })),
);
const OrdersPage = React.lazy(() => import('./pages/Orders/OrdersPage'));
const FinancePage = React.lazy(() => import('./pages/Finance/FinancePage'));
const ClientLedgerPage = React.lazy(
  () => import('./pages/Finance/ClientLedgerPage'),
);
const VouchersPage = React.lazy(
  () => import('./pages/Finance/VouchersPage'),
);
const ReportsPage = React.lazy(() => import('./pages/Finance/ReportsPage'));
const ProfitLossPage = React.lazy(() =>
  import('./pages/Finance/Reports/ProfitLossReport').then((m) => ({ default: m.ProfitLossReport })),
);
const JournalEntriesPage = React.lazy(() =>
  import('./pages/Finance/Accounting/JournalEntriesPage').then((m) => ({ default: m.JournalEntriesPage })),
);
const GeneralLedgerPage = React.lazy(() =>
  import('./pages/Finance/Accounting/GeneralLedgerPage').then((m) => ({ default: m.GeneralLedgerPage })),
);
const TrialBalancePage = React.lazy(() =>
  import('./pages/Finance/Accounting/TrialBalancePage').then((m) => ({ default: m.TrialBalancePage })),
);
const SettingsPage = React.lazy(
  () => import('./pages/Settings/SettingsPage'),
);
const HRPage = React.lazy(() => import('./pages/HR/HRPage'));
const VerifyPage = React.lazy(() => import('./pages/Verify/VerifyPage'));
const CostPriceReportPage = React.lazy(() =>
  import('./pages/Production/CostPriceReport').then((m) => ({ default: m.CostPriceReport })),
);
const MonthlyOverheadPage = React.lazy(() =>
  import('./pages/Production/MonthlyOverheadPage').then((m) => ({ default: m.MonthlyOverheadPage })),
);
const NotFoundPage = React.lazy(() => import('./pages/NotFound'));

// --------------- Guards ---------------

function RoleGuard({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { hasRole } = useRole();
  if (!hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <OfflineBanner />
        <Header onMenuToggle={() => setSidebarCollapsed((c) => !c)} />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <Suspense fallback={<LoadingSpinner />}>
            <Outlet />
          </Suspense>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}

// --------------- Lazy wrapper ---------------
function Lazy({ element: El }: { element: React.LazyExoticComponent<React.ComponentType> }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <El />
    </Suspense>
  );
}

// --------------- Route config ---------------
const allRoles = Object.values(ROLES);

export const routes: RouteObject[] = [
  // Public routes
  {
    path: '/login',
    element: <Lazy element={LoginPage} />,
  },
  {
    path: '/verify',
    element: <Lazy element={VerifyPage} />,
  },
  {
    path: '/gp-verify',
    element: <Lazy element={VerifyGatePassPage} />,
  },

  // Protected routes
  {
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: (
          <RoleGuard roles={allRoles}>
            <Lazy element={DashboardPage} />
          </RoleGuard>
        ),
      },
      {
        path: 'production/*',
        element: (
          <RoleGuard roles={[ROLES.SUPER_ADMIN, ROLES.PRODUCTION_HEAD]}>
            <Lazy element={ProductionPage} />
          </RoleGuard>
        ),
      },
      {
        path: 'cost-price',
        element: (
          <RoleGuard roles={[ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD]}>
            <Lazy element={CostPriceReportPage} />
          </RoleGuard>
        ),
      },
      {
        path: 'monthly-overhead',
        element: (
          <RoleGuard roles={[ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD]}>
            <Lazy element={MonthlyOverheadPage} />
          </RoleGuard>
        ),
      },
      {
        path: 'inventory/*',
        element: (
          <RoleGuard
            roles={[
              ROLES.SUPER_ADMIN,
              ROLES.PRODUCTION_HEAD,
              ROLES.FINANCE_HEAD,
              ROLES.LOGISTICS_HEAD,
            ]}
          >
            <Lazy element={InventoryPage} />
          </RoleGuard>
        ),
      },
      {
        path: 'gate-pass/*',
        element: (
          <RoleGuard roles={[ROLES.SUPER_ADMIN, ROLES.LOGISTICS_HEAD]}>
            <Lazy element={GatePassPage} />
          </RoleGuard>
        ),
      },
      {
        path: 'sales-returns',
        element: (
          <RoleGuard roles={[ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD, ROLES.LOGISTICS_HEAD]}>
            <Lazy element={SalesReturnPage} />
          </RoleGuard>
        ),
      },
      {
        path: 'orders/*',
        element: (
          <RoleGuard
            roles={[
              ROLES.SUPER_ADMIN,
              ROLES.FINANCE_HEAD,
              ROLES.PRODUCTION_HEAD,
              ROLES.MARKETING_HEAD,
            ]}
          >
            <Lazy element={OrdersPage} />
          </RoleGuard>
        ),
      },
      {
        path: 'finance',
        element: (
          <RoleGuard roles={[ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD]}>
            <Outlet />
          </RoleGuard>
        ),
        children: [
          { index: true, element: <Lazy element={FinancePage} /> },
          {
            path: 'client-ledger/*',
            element: <Lazy element={ClientLedgerPage} />,
          },
          { path: 'vouchers/*', element: <Lazy element={VouchersPage} /> },
          { path: 'reports', element: <Lazy element={ReportsPage} /> },
          { path: 'profit-loss', element: <Lazy element={ProfitLossPage} /> },
          { path: 'journal-entries', element: <Lazy element={JournalEntriesPage} /> },
          { path: 'general-ledger', element: <Lazy element={GeneralLedgerPage} /> },
          { path: 'trial-balance', element: <Lazy element={TrialBalancePage} /> },
        ],
      },
      {
        path: 'hr/*',
        element: (
          <RoleGuard roles={[ROLES.SUPER_ADMIN, ROLES.HR_HEAD]}>
            <Lazy element={HRPage} />
          </RoleGuard>
        ),
      },
      {
        path: 'settings/*',
        element: (
          <RoleGuard roles={[ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD]}>
            <Lazy element={SettingsPage} />
          </RoleGuard>
        ),
      },
    ],
  },

  // 404
  {
    path: '*',
    element: <Lazy element={NotFoundPage} />,
  },
];
