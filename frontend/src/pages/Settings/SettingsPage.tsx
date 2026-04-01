import { Routes, Route, Navigate } from 'react-router-dom';
import { UserManagement } from './UserManagement';
import { ClientManagement } from './ClientManagement';
import { ExpenseCategories } from './ExpenseCategories';
import { VariantGrainManagement } from './VariantGrainManagement';
import { PlantWorkerManagement } from './PlantWorkerManagement';
import { SystemSettings } from './SystemSettings';
import { SettingsOverview } from './SettingsOverview';

export default function SettingsPage() {
  return (
    <Routes>
      <Route index element={<SettingsOverview />} />
      <Route path="users" element={<UserManagement />} />
      <Route path="clients" element={<ClientManagement />} />
      <Route path="expense-categories" element={<ExpenseCategories />} />
      <Route path="variants" element={<VariantGrainManagement />} />
      <Route path="plants" element={<PlantWorkerManagement />} />
      <Route path="system" element={<SystemSettings />} />
      <Route path="*" element={<Navigate to="/settings" replace />} />
    </Routes>
  );
}
