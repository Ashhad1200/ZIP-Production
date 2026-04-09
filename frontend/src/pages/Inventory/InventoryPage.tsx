import { Routes, Route, Navigate } from 'react-router-dom';
import { RawMaterialStock } from './RawMaterialStock';
import { PurchaseForm } from './PurchaseForm';
import { FinishedGoodsStock } from './FinishedGoodsStock';
import { ConsumptionReport } from './ConsumptionReport';
import { FifoBatchesPage } from './FifoBatchesPage';
import { ElectricityRatesPage } from './ElectricityRatesPage';

export default function InventoryPage() {
  return (
    <Routes>
      <Route index element={<RawMaterialStock />} />
      <Route path="raw-materials" element={<RawMaterialStock />} />
      <Route path="purchases" element={<PurchaseForm />} />
      <Route path="finished-goods" element={<FinishedGoodsStock />} />
      <Route path="consumption-report" element={<ConsumptionReport />} />
      <Route path="batches" element={<FifoBatchesPage />} />
      <Route path="electricity-rates" element={<ElectricityRatesPage />} />
      <Route path="*" element={<Navigate to="/inventory" replace />} />
    </Routes>
  );
}
