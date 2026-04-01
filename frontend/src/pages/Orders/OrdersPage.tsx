import { Routes, Route, Navigate } from 'react-router-dom';
import { OrderDashboard } from './OrderDashboard';
import { OrderDetail } from './OrderDetail';
import { ClientOrderHistory } from './ClientOrderHistory';

export default function OrdersPage() {
  return (
    <Routes>
      <Route index element={<OrderDashboard />} />
      <Route path=":id" element={<OrderDetail />} />
      <Route path="client/:clientId" element={<ClientOrderHistory />} />
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}
