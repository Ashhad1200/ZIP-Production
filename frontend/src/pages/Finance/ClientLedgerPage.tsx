import { Routes, Route, Navigate } from 'react-router-dom';
import { ClientList } from './ClientLedger/ClientList';
import { LedgerDetail } from './ClientLedger/LedgerDetail';
import { RateManagement } from './ClientLedger/RateManagement';

export default function ClientLedgerPage() {
  return (
    <Routes>
      <Route index element={<ClientList />} />
      <Route path=":clientId" element={<LedgerDetail />} />
      <Route path=":clientId/rates" element={<RateManagement />} />
      <Route path="*" element={<Navigate to="/finance/client-ledger" replace />} />
    </Routes>
  );
}
