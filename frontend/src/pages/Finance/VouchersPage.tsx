import { Routes, Route, Navigate } from 'react-router-dom';
import { VoucherList } from './Vouchers/VoucherList';
import { VoucherApproval } from './Vouchers/VoucherApproval';

export default function VouchersPage() {
  return (
    <Routes>
      <Route index element={<VoucherList />} />
      <Route path="approval" element={<VoucherApproval />} />
      <Route path="*" element={<Navigate to="/finance/vouchers" replace />} />
    </Routes>
  );
}
