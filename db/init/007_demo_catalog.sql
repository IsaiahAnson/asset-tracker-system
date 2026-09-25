
-- ============================================================================
-- Demo catalog data (2026-05-25; licenses removed 2026-05-26): accessories,
-- consumables, and components grouped by supplier / purchase order so the
-- Procurement and Suppliers pages have realistic data on a fresh seed.
-- Idempotent via WHERE NOT EXISTS on (table, name) since these tables lack a
-- unique name constraint. group_id intentionally left NULL (global catalog).
--
-- Purchase orders represented:
--   PO-2025-0001 | CDW-G           | 2 accessories + 3 components
--   PO-2025-0003 | Amazon Business | 3 consumables
--   PO-2025-0004 | Carahsoft Gov   | 1 accessory
-- ============================================================================

-- Accessories (PO-2025-0001 from CDW-G, plus PO-2025-0004 from Carahsoft Gov)
INSERT INTO accessories (name, category, manufacturer, model_number, qty, min_amt, location, supplier, purchase_date, purchase_cost, order_number)
SELECT 'Wireless Mouse', 'Peripherals', 'Logitech', 'M705', 12, 10, 'Atlanta Field Office', 'CDW-G', DATE '2025-03-12', 312.15, 'PO-2025-0001'
WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE name = 'Wireless Mouse');

INSERT INTO accessories (name, category, manufacturer, model_number, qty, min_amt, location, supplier, purchase_date, purchase_cost, order_number)
SELECT 'YubiKey 5 NFC', 'Security', 'Yubico', '5-NFC', 6, 8, 'Headquarters', 'CDW-G', DATE '2025-03-12', 307.17, 'PO-2025-0001'
WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE name = 'YubiKey 5 NFC');

INSERT INTO accessories (name, category, manufacturer, model_number, qty, min_amt, location, supplier, purchase_date, purchase_cost, order_number)
SELECT 'USB-C Dock', 'Peripherals', 'Dell', 'WD19S', 40, 5, 'Headquarters', 'Carahsoft Gov', DATE '2025-05-02', 154.10, 'PO-2025-0004'
WHERE NOT EXISTS (SELECT 1 FROM accessories WHERE name = 'USB-C Dock');

-- Consumables (PO-2025-0003, Amazon Business)
INSERT INTO consumables (name, category, manufacturer, item_no, qty, min_amt, location, supplier, purchase_date, purchase_cost, order_number)
SELECT 'AA Batteries (pack)', 'General', 'Duracell', 'AA-24', 60, 15, 'Atlanta Field Office', 'Amazon Business', DATE '2025-04-20', 30.11, 'PO-2025-0003'
WHERE NOT EXISTS (SELECT 1 FROM consumables WHERE name = 'AA Batteries (pack)');

INSERT INTO consumables (name, category, manufacturer, item_no, qty, min_amt, location, supplier, purchase_date, purchase_cost, order_number)
SELECT 'Evidence Bags (large)', 'Investigative', 'Sirchie', 'EB-LG', 4, 20, 'Dallas Field Office', 'Amazon Business', DATE '2025-04-20', 94.55, 'PO-2025-0003'
WHERE NOT EXISTS (SELECT 1 FROM consumables WHERE name = 'Evidence Bags (large)');

INSERT INTO consumables (name, category, manufacturer, item_no, qty, min_amt, location, supplier, purchase_date, purchase_cost, order_number)
SELECT 'Toner Cartridge 58A', 'Printing', 'HP', 'CF258A', 25, 5, 'Headquarters', 'Amazon Business', DATE '2025-04-20', 87.00, 'PO-2025-0003'
WHERE NOT EXISTS (SELECT 1 FROM consumables WHERE name = 'Toner Cartridge 58A');

-- Components (PO-2025-0001, CDW-G)
INSERT INTO components (name, category, manufacturer, model_number, qty, min_amt, location, supplier, purchase_date, purchase_cost, order_number)
SELECT '16GB DDR5 SODIMM', 'Memory', 'Crucial', 'CT16G56C46S5', 30, 5, 'Headquarters', 'CDW-G', DATE '2025-03-12', 434.83, 'PO-2025-0001'
WHERE NOT EXISTS (SELECT 1 FROM components WHERE name = '16GB DDR5 SODIMM');

INSERT INTO components (name, category, manufacturer, model_number, qty, min_amt, location, supplier, purchase_date, purchase_cost, order_number)
SELECT '1TB NVMe SSD', 'Storage', 'Samsung', '990-PRO-1TB', 8, 10, 'Headquarters', 'CDW-G', DATE '2025-03-12', 267.16, 'PO-2025-0001'
WHERE NOT EXISTS (SELECT 1 FROM components WHERE name = '1TB NVMe SSD');

INSERT INTO components (name, category, manufacturer, model_number, qty, min_amt, location, supplier, purchase_date, purchase_cost, order_number)
SELECT 'Smart Card Reader', 'Peripherals', 'Identiv', 'SCR3500', 18, 6, 'Atlanta Field Office', 'CDW-G', DATE '2025-03-12', 86.21, 'PO-2025-0001'
WHERE NOT EXISTS (SELECT 1 FROM components WHERE name = 'Smart Card Reader');
