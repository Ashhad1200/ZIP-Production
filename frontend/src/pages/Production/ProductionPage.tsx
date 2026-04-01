import { Routes, Route, Navigate } from 'react-router-dom';
import { ProductionEntries } from './ProductionEntries';
import { ProductionEntryForm } from './ProductionEntryForm';
import { DailyProgressReport } from './DailyProgressReport';
import { ScrapSales } from './ScrapSales';
import { Discrepancies } from './Discrepancies';

export default function ProductionPage() {
  return (
    <Routes>
      <Route index element={<ProductionEntries />} />
      <Route path="new" element={<ProductionEntryForm />} />
      <Route path="daily-report" element={<DailyProgressReport />} />
      <Route path="scrap-sales" element={<ScrapSales />} />
      <Route path="discrepancies" element={<Discrepancies />} />
      <Route path="*" element={<Navigate to="/production" replace />} />
    </Routes>
  );
}
