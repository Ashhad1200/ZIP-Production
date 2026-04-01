-- Performance indexes for polling queries

-- Finished goods stock - polled every 5s
CREATE INDEX IF NOT EXISTS "idx_finished_goods_stock_updated_at" ON "finished_goods_stock"("updatedAt");

-- Raw material stock - polled every 5s
CREATE INDEX IF NOT EXISTS "idx_raw_material_stock_updated_at" ON "raw_material_stock"("updatedAt");

-- Gate passes by client + date (common filter)
CREATE INDEX IF NOT EXISTS "idx_gate_pass_client_date" ON "gate_passes"("clientId", "date");

-- Orders by client + status (common filter)
CREATE INDEX IF NOT EXISTS "idx_order_client_status" ON "orders"("clientId", "status");

-- Production entries by plant + date
CREATE INDEX IF NOT EXISTS "idx_production_entry_plant_date" ON "production_entries"("plantId", "date");

-- Notifications unread for polling
CREATE INDEX IF NOT EXISTS "idx_notification_user_read" ON "notifications"("recipientUserId", "isRead");
