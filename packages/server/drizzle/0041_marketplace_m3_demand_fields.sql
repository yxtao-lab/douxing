-- M3-3 · 需求单人数与发票抬头字段
ALTER TABLE `service_demand`
  ADD COLUMN `headcount` int NULL,
  ADD COLUMN `invoice_info` json NULL;
