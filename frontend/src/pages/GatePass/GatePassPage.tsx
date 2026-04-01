import { Routes, Route, Navigate } from 'react-router-dom';
import { GatePassList } from './GatePassList';
import { GatePassForm } from './GatePassForm';
import { GatePassDetail } from './GatePassDetail';
import { GatePassPDF } from './GatePassPDF';

export default function GatePassPage() {
  return (
    <Routes>
      <Route index element={<GatePassList />} />
      <Route path="new" element={<GatePassForm />} />
      <Route path=":id" element={<GatePassDetail />} />
      <Route path=":id/pdf" element={<GatePassPDF />} />
      <Route path="*" element={<Navigate to="/gate-pass" replace />} />
    </Routes>
  );
}
