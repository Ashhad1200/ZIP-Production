import { Routes, Route, Navigate } from 'react-router-dom';
import { UserManagement } from './UserManagement';
import { CompanyManagement } from './CompanyManagement';
import { ClientManagement } from './ClientManagement';
import { ExpenseCategories } from './ExpenseCategories';
import { VariantGrainManagement } from './VariantGrainManagement';
import { RecipeManagement } from './RecipeManagement';
import { PlantWorkerManagement } from './PlantWorkerManagement';
import { SystemSettings } from './SystemSettings';
import { SettingsOverview } from './SettingsOverview';
import { VendorManagement } from './VendorManagement';

export default function SettingsPage() {
  return (
    <Routes>
      <Route index element={<SettingsOverview />} />
      <Route path="users" element={<UserManagement />} />
      <Route path="companies" element={<CompanyManagement />} />
      <Route path="clients" element={<ClientManagement />} />
      <Route path="vendors" element={<VendorManagement />} />
      <Route path="expense-categories" element={<ExpenseCategories />} />
      <Route path="recipes" element={<RecipeManagement />} />
      <Route path="variants" element={<VariantGrainManagement />} />
      <Route path="plants" element={<PlantWorkerManagement />} />
      <Route path="system" element={<SystemSettings />} />
      <Route path="*" element={<Navigate to="/settings" replace />} />
    </Routes>
  );
}
