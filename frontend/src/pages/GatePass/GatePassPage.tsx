import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { GatePassList } from './GatePassList';
import { GatePassForm } from './GatePassForm';
import { GatePassDetail } from './GatePassDetail';
import { LoadingSpinner } from '../../components/ui';

// Lazy-load the PDF page separately so @react-pdf/renderer only loads on demand
const GatePassPDF = lazy(() =>
  import('./GatePassPDF').then((m) => ({ default: m.GatePassPDF })),
);

export default function GatePassPage() {
  return (
    <Routes>
      <Route index element={<GatePassList />} />
      <Route path="new" element={<GatePassForm />} />
      <Route path=":id" element={<GatePassDetail />} />
      <Route
        path=":id/pdf"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <GatePassPDF />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/gate-pass" replace />} />
    </Routes>
  );
}
