-- ============================================================================
-- 011_demo_population.sql (2026-06-10) — Living demo data.
--
-- Brings every page to life with realistic volume: more offices, people,
-- computers (varied statuses, custodians, dates), custody history, custom
-- field values, maintenance, requests, workflows, approvals, audit activity,
-- and accessory / consumable / component usage.
--
-- Fully idempotent (ON CONFLICT / WHERE NOT EXISTS), so it is safe to re-apply
-- and is wiped/rebuilt cleanly by reset-db.sh. All data is fictional. No real
-- PII. No em dashes in any copy.
-- ============================================================================

-- ── Offices ────────────────────────────────────────────────────────────────
INSERT INTO groups (code, name) VALUES
  ('NWA-CHI', 'Chicago Field Office'),
  ('NWA-OAK', 'Oakland Field Office')
ON CONFLICT (code) DO NOTHING;
UPDATE groups child SET parent_group_id = parent.id
  FROM groups parent WHERE parent.code = 'NWA' AND child.code IN ('NWA-CHI', 'NWA-OAK');

-- ── People (plain employees, no system role) ────────────────────────────────
INSERT INTO app_users (external_id, email, personal_email, display_name, group_id, firearm_access)
SELECT v.ext, v.email, v.pemail, v.name, g.id, v.fa
FROM (VALUES
  ('hr:slindgren','sarah.lindgren@northwind.example','sarah.lindgren@example.com','Sarah Lindgren','NWA-HQ', false),
  ('hr:mwebb','marcus.webb@northwind.example','marcus.webb@example.com','Marcus Webb','NWA-ATL', true),
  ('hr:ecastillo','elena.castillo@northwind.example','elena.castillo@example.com','Elena Castillo','NWA-DAL', false),
  ('hr:dbrooks','devon.brooks@northwind.example','devon.brooks@example.com','Devon Brooks','NWA-HQ', false),
  ('hr:arahman','aisha.rahman@northwind.example','aisha.rahman@example.com','Aisha Rahman','NWA-CHI', false),
  ('hr:cstone','caleb.stone@northwind.example','caleb.stone@example.com','Caleb Stone','NWA-OAK', false),
  ('hr:npetrov','nina.petrov@northwind.example','nina.petrov@example.com','Nina Petrov','NWA-HQ', true),
  ('hr:ohaddad','omar.haddad@northwind.example','omar.haddad@example.com','Omar Haddad','NWA-ATL', false),
  ('hr:rmendez','rosa.mendez@northwind.example','rosa.mendez@example.com','Rosa Mendez','NWA-DAL', false),
  ('hr:twalsh','theo.walsh@northwind.example','theo.walsh@example.com','Theo Walsh','NWA-CHI', false),
  ('hr:gokafor','grace.okafor@northwind.example','grace.okafor@example.com','Grace Okafor','NWA-HQ', false),
  ('hr:hschmidt','henry.schmidt@northwind.example','henry.schmidt@example.com','Henry Schmidt','NWA-OAK', false),
  ('hr:lnakamura','lila.nakamura@northwind.example','lila.nakamura@example.com','Lila Nakamura','NWA-ATL', true),
  ('hr:vreyes','victor.reyes@northwind.example','victor.reyes@example.com','Victor Reyes','NWA-DAL', false),
  ('hr:mpatel','maya.patel@northwind.example','maya.patel@example.com','Maya Patel','NWA-HQ', false),
  ('hr:dcho','daniel.cho@northwind.example','daniel.cho@example.com','Daniel Cho','NWA-CHI', false)
) AS v(ext, email, pemail, name, gcode, fa)
JOIN groups g ON g.code = v.gcode
ON CONFLICT (email) DO NOTHING;

-- ── Computer assets (varied) ─────────────────────────────────────────────────
-- due dates before 2026-06-10 on assigned units intentionally drive the
-- dashboard "overdue checkouts" attention item.
INSERT INTO assets (asset_tag, category_id, group_id, serial_number, manufacturer, model, status, current_custodian_id, office, high_sensitivity, acquired_on, expected_return_on, disposed_on)
SELECT v.tag, c.id, g.id, v.serial, v.mfr, v.model, v.status, u.id, v.office, false,
       (v.acquired)::date, (v.due)::date, (v.disposed)::date
FROM (VALUES
  ('NWA-CMP-20001','5CD2391AA1','Dell','Latitude 7450','assigned','sarah.lindgren@northwind.example','Headquarters','NWA-HQ','2024-02-10', NULL, NULL),
  ('NWA-CMP-20002','5CD2391BB2','Dell','Latitude 7450','assigned','marcus.webb@northwind.example','Atlanta Field Office','NWA-ATL','2024-02-10','2026-05-15', NULL),
  ('NWA-CMP-20003','PF3KX091','Lenovo','ThinkPad X1 Carbon','assigned','elena.castillo@northwind.example','Dallas Field Office','NWA-DAL','2023-09-22', NULL, NULL),
  ('NWA-CMP-20004','PF3KX092','Lenovo','ThinkPad X1 Carbon','assigned','devon.brooks@northwind.example','Headquarters','NWA-HQ','2023-09-22', NULL, NULL),
  ('NWA-CMP-20005','C02XENON9','Apple','MacBook Pro 14','assigned','aisha.rahman@northwind.example','Chicago Field Office','NWA-CHI','2025-01-15', NULL, NULL),
  ('NWA-CMP-20006','C02XENO10','Apple','MacBook Pro 14','assigned','caleb.stone@northwind.example','Oakland Field Office','NWA-OAK','2025-01-15','2026-05-28', NULL),
  ('NWA-CMP-20007','5CG2401HP1','HP','EliteBook 840','assigned','nina.petrov@northwind.example','Headquarters','NWA-HQ','2024-06-30', NULL, NULL),
  ('NWA-CMP-20008','5CG2401HP2','HP','EliteBook 840','assigned','omar.haddad@northwind.example','Atlanta Field Office','NWA-ATL','2024-06-30', NULL, NULL),
  ('NWA-CMP-20009','MSL5-0099','Microsoft','Surface Laptop 5','assigned','rosa.mendez@northwind.example','Dallas Field Office','NWA-DAL','2024-11-05', NULL, NULL),
  ('NWA-CMP-20010','PF3KT140A','Lenovo','ThinkPad T14','assigned','theo.walsh@northwind.example','Chicago Field Office','NWA-CHI','2023-04-18', NULL, NULL),
  ('NWA-CMP-20011','PF3KT140B','Lenovo','ThinkPad T14','assigned','grace.okafor@northwind.example','Headquarters','NWA-HQ','2023-04-18', NULL, NULL),
  ('NWA-CMP-20012','5CD25PRX01','Dell','Precision 5570','assigned','henry.schmidt@northwind.example','Oakland Field Office','NWA-OAK','2025-03-01', NULL, NULL),
  ('NWA-CMP-20013','5CD25PRX02','Dell','Precision 5570','assigned','victor.reyes@northwind.example','Dallas Field Office','NWA-DAL','2025-03-01', NULL, NULL),
  ('NWA-CMP-20014','5CG2401HP3','HP','EliteBook 840','assigned','maya.patel@northwind.example','Headquarters','NWA-HQ','2024-06-30', NULL, NULL),
  ('NWA-CMP-20015','MXC9Q14LZ9','Dell','Latitude 7450','available', NULL,'Headquarters','NWA-HQ','2025-02-20', NULL, NULL),
  ('NWA-CMP-20016','MXC9Q14LZ0','Dell','Latitude 7450','available', NULL,'Atlanta Field Office','NWA-ATL','2025-02-20', NULL, NULL),
  ('NWA-CMP-20017','PF3KX093','Lenovo','ThinkPad X1 Carbon','available', NULL,'Dallas Field Office','NWA-DAL','2025-04-10', NULL, NULL),
  ('NWA-CMP-20018','MSL5-0100','Microsoft','Surface Laptop 5','available', NULL,'Chicago Field Office','NWA-CHI','2024-11-05', NULL, NULL),
  ('NWA-CMP-20019','WOD-7H6D01','Dell','OptiPlex 7010','available', NULL,'Headquarters','NWA-HQ','2023-07-12', NULL, NULL),
  ('NWA-CMP-20020','WOD-7H6D02','Dell','OptiPlex 7010','in_repair', NULL,'Atlanta Field Office','NWA-ATL','2023-07-12', NULL, NULL),
  ('NWA-CMP-20021','5CG2401HP4','HP','EliteBook 840','in_repair', NULL,'Dallas Field Office','NWA-DAL','2024-06-30', NULL, NULL),
  ('NWA-CMP-20022','PF3KT140C','Lenovo','ThinkPad T14','in_transfer', NULL,'Headquarters','NWA-HQ','2023-04-18', NULL, NULL),
  ('NWA-CMP-20023','5CD2210OLD','Dell','Latitude 7420','retired', NULL,'Headquarters','NWA-HQ','2020-08-01', NULL, '2026-04-30'),
  ('NWA-CMP-20024','C02OLDMBP','Apple','MacBook Pro 13','retired', NULL,'Atlanta Field Office','NWA-ATL','2019-05-14', NULL, '2026-03-18')
) AS v(tag, serial, mfr, model, status, cust_email, office, gcode, acquired, due, disposed)
JOIN asset_categories c ON c.code = 'computers'
JOIN groups g ON g.code = v.gcode
LEFT JOIN app_users u ON u.email = v.cust_email
WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.asset_tag = v.tag);

-- ── Custody history ──────────────────────────────────────────────────────────
INSERT INTO custody_events (asset_id, from_user_id, to_user_id, event_type, performed_by, event_at, notes)
SELECT a.id, fu.id, tu.id, v.etype, pb.id, (v.at)::timestamptz, v.notes
FROM (VALUES
  ('NWA-CMP-20001', NULL,'sarah.lindgren@northwind.example','issue','jordan.rivera@northwind.example','2024-02-12 10:00-05','Initial issuance at onboarding'),
  ('NWA-CMP-20002', NULL,'marcus.webb@northwind.example','issue','jordan.rivera@northwind.example','2024-02-12 10:20-05','Initial issuance at onboarding'),
  ('NWA-CMP-20003', NULL,'elena.castillo@northwind.example','issue','logan.kim@northwind.example','2023-09-25 09:15-04','Initial issuance'),
  ('NWA-CMP-20004', NULL,'devon.brooks@northwind.example','issue','jordan.rivera@northwind.example','2023-09-25 09:30-04','Initial issuance'),
  ('NWA-CMP-20005', NULL,'aisha.rahman@northwind.example','issue','logan.kim@northwind.example','2025-01-17 11:00-05','Initial issuance'),
  ('NWA-CMP-20006', NULL,'caleb.stone@northwind.example','issue','jordan.rivera@northwind.example','2025-01-17 11:20-05','Initial issuance'),
  ('NWA-CMP-20007', NULL,'nina.petrov@northwind.example','issue','jordan.rivera@northwind.example','2024-07-02 08:45-04','Initial issuance'),
  ('NWA-CMP-20011','grace.okafor@northwind.example','grace.okafor@northwind.example','transfer','jordan.rivera@northwind.example','2025-05-09 13:30-04','Reassigned within Headquarters'),
  ('NWA-CMP-20023', NULL,'devon.brooks@northwind.example','issue','jordan.rivera@northwind.example','2020-08-05 10:00-04','Initial issuance'),
  ('NWA-CMP-20023','devon.brooks@northwind.example', NULL,'disposition','dana.park@northwind.example','2026-04-30 15:00-04','End of life, sanitized and surplused'),
  ('NWA-CMP-20024', NULL, NULL,'disposition','dana.park@northwind.example','2026-03-18 14:00-04','End of life, sanitized and surplused')
) AS v(tag, from_email, to_email, etype, perf_email, at, notes)
JOIN assets a ON a.asset_tag = v.tag
LEFT JOIN app_users fu ON fu.email = v.from_email
LEFT JOIN app_users tu ON tu.email = v.to_email
JOIN app_users pb ON pb.email = v.perf_email
WHERE NOT EXISTS (
  SELECT 1 FROM custody_events ce WHERE ce.asset_id = a.id AND ce.event_type = v.etype AND ce.event_at = (v.at)::timestamptz
);

-- ── Custom field values across many assets ──────────────────────────────────
INSERT INTO asset_custom_field_value (asset_id, field_definition_id, value)
SELECT a.id, d.id, v.value
FROM (VALUES
  ('NWA-CMP-20001','lifecycle_status','In Service'),
  ('NWA-CMP-20001','fisma_system','Moderate'),
  ('NWA-CMP-20001','encryption_verified','true'),
  ('NWA-CMP-20001','property_pass_number','PP-2024-0210'),
  ('NWA-CMP-20002','lifecycle_status','In Service'),
  ('NWA-CMP-20002','fisma_system','Moderate'),
  ('NWA-CMP-20002','encryption_verified','true'),
  ('NWA-CMP-20003','lifecycle_status','In Service'),
  ('NWA-CMP-20003','fisma_system','High'),
  ('NWA-CMP-20003','encryption_verified','true'),
  ('NWA-CMP-20005','lifecycle_status','In Service'),
  ('NWA-CMP-20005','fisma_system','Moderate'),
  ('NWA-CMP-20005','warranty_expiration','2027-01-15'),
  ('NWA-CMP-20007','lifecycle_status','In Service'),
  ('NWA-CMP-20007','fisma_system','Low'),
  ('NWA-CMP-20012','lifecycle_status','In Service'),
  ('NWA-CMP-20012','fisma_system','High'),
  ('NWA-CMP-20012','encryption_verified','true'),
  ('NWA-CMP-20012','warranty_expiration','2028-03-01'),
  ('NWA-CMP-20015','lifecycle_status','Spare'),
  ('NWA-CMP-20015','fisma_system','Moderate'),
  ('NWA-CMP-20019','lifecycle_status','Spare'),
  ('NWA-CMP-20020','lifecycle_status','In Service'),
  ('NWA-CMP-20020','encryption_verified','false'),
  ('NWA-CMP-20023','lifecycle_status','Surplus'),
  ('NWA-CMP-20024','lifecycle_status','Surplus')
) AS v(tag, field_key, value)
JOIN assets a ON a.asset_tag = v.tag
JOIN custom_field_definitions d ON d.entity = 'asset' AND d.field_key = v.field_key
ON CONFLICT (asset_id, field_definition_id) DO NOTHING;

-- ── Maintenance log ──────────────────────────────────────────────────────────
INSERT INTO maintenances (asset_id, maintenance_type, title, supplier, start_date, completion_date, cost, notes)
SELECT a.id, v.mtype, v.title, v.supplier, (v.start)::date, (v.done)::date, v.cost, v.notes
FROM (VALUES
  ('NWA-CMP-20020','repair','Keyboard replacement','Dell Pro Support','2026-06-02', NULL, 145.00,'Sticky keys reported, awaiting parts'),
  ('NWA-CMP-20021','repair','Battery swap and diagnostics','HP Care Pack','2026-06-05', NULL, 210.00,'Battery not holding charge'),
  ('NWA-CMP-20003','upgrade','Memory upgrade to 32GB','CDW-G','2026-05-12','2026-05-13', 180.00,'Performance request approved'),
  ('NWA-CMP-20007','calibration','Display color calibration','In-house','2026-04-22','2026-04-22', 0.00,'Annual calibration'),
  ('NWA-CMP-20001','inspection','Annual security inspection','In-house','2026-03-10','2026-03-10', 0.00,'Encryption and patch level verified'),
  ('NWA-CMP-20005','warranty','Logic board warranty claim','Apple Enterprise','2026-02-18','2026-03-01', 0.00,'Covered under warranty'),
  ('NWA-CMP-20012','upgrade','NVMe storage expansion','CDW-G','2026-05-28','2026-05-29', 267.00,'1TB drive added'),
  ('NWA-CMP-20010','repair','Hinge repair','Lenovo Premier','2026-01-15','2026-01-22', 95.00,'Cracked hinge housing'),
  ('NWA-CMP-20013','inspection','Pre-deployment imaging check','In-house','2026-06-08', NULL, 0.00,'Baseline image validation'),
  ('NWA-CMP-20009','other','Asset tag re-label','In-house','2026-05-30','2026-05-30', 0.00,'Barcode reprinted')
) AS v(tag, mtype, title, supplier, start, done, cost, notes)
JOIN assets a ON a.asset_tag = v.tag
WHERE NOT EXISTS (SELECT 1 FROM maintenances m WHERE m.asset_id = a.id AND m.title = v.title);

-- ── Asset requests ────────────────────────────────────────────────────────────
INSERT INTO asset_requests (request_number, requested_by, item_label, category, status, notes, decided_at)
SELECT v.num, u.id, v.item, v.cat, v.status, v.notes, (v.decided)::timestamptz
FROM (VALUES
  ('REQ-2026-0101','sarah.lindgren@northwind.example','Second monitor (27 inch)','Peripherals','pending','Dual-monitor setup for analysis work', NULL),
  ('REQ-2026-0102','marcus.webb@northwind.example','Docking station','Peripherals','approved','Standard issue for field laptop','2026-06-03 10:00-04'),
  ('REQ-2026-0103','elena.castillo@northwind.example','Noise-cancelling headset','Peripherals','fulfilled','For remote depositions','2026-05-20 09:00-04'),
  ('REQ-2026-0104','devon.brooks@northwind.example','Laptop replacement','IT Equipment','pending','Current unit past refresh cycle', NULL),
  ('REQ-2026-0105','aisha.rahman@northwind.example','External SSD (encrypted)','Peripherals','denied','Use network storage instead','2026-05-27 13:00-04'),
  ('REQ-2026-0106','nina.petrov@northwind.example','Webcam','Peripherals','approved','Replacement for failed built-in camera','2026-06-06 11:00-04'),
  ('REQ-2026-0107','theo.walsh@northwind.example','Standing desk converter','Office Furniture','pending','Ergonomic accommodation', NULL),
  ('REQ-2026-0108','grace.okafor@northwind.example','YubiKey (spare)','Security','fulfilled','Backup security key','2026-05-15 14:30-04')
) AS v(num, req_email, item, cat, status, notes, decided)
JOIN app_users u ON u.email = v.req_email
ON CONFLICT (request_number) DO NOTHING;

-- ── Workflows + approvals (broader queue) ────────────────────────────────────
INSERT INTO workflows (workflow_number, group_id, workflow_type, subject_user_id, owner_user_id, status, stage, due_on)
SELECT v.num, g.id, v.wtype, subj.id, owner.id, v.status, v.stage, (v.due)::date
FROM (VALUES
  ('WF-2026-0440','NWA-HQ','onboarding','sarah.lindgren@northwind.example','jordan.rivera@northwind.example','completed','Issued','2026-02-12'),
  ('WF-2026-0441','NWA-DAL','offboarding','victor.reyes@northwind.example','logan.kim@northwind.example','in_review','Equipment return','2026-06-18'),
  ('WF-2026-0442','NWA-HQ','transfer','grace.okafor@northwind.example','jordan.rivera@northwind.example','ready','Approver review','2026-06-14'),
  ('WF-2026-0443','NWA-ATL','disposition', NULL,'dana.park@northwind.example','at_risk','Escalated review','2026-06-09')
) AS v(num, gcode, wtype, subj_email, owner_email, status, stage, due)
JOIN groups g ON g.code = v.gcode
LEFT JOIN app_users subj ON subj.email = v.subj_email
JOIN app_users owner ON owner.email = v.owner_email
ON CONFLICT (workflow_number) DO NOTHING;

INSERT INTO approvals (approval_number, workflow_id, approver_user_id, request_summary, status, submitted_at, decided_at, decision_notes)
SELECT v.num, w.id, ap.id, v.summary, v.status, (v.sub)::timestamptz, (v.dec)::timestamptz, v.notes
FROM (VALUES
  ('APR-3410','WF-2026-0441','avery.chen@northwind.example','Offboarding equipment return for Victor Reyes','pending','2026-06-08 09:00-04', NULL, NULL),
  ('APR-3411','WF-2026-0442','logan.kim@northwind.example','Custody transfer of NWA-CMP-20011 within Headquarters','approved','2026-06-05 10:00-04','2026-06-06 09:30-04','Operational need confirmed'),
  ('APR-3412','WF-2026-0443','avery.chen@northwind.example','Disposition batch for retired Atlanta laptops','escalated','2026-06-04 08:00-04', NULL, NULL),
  ('APR-3413', NULL,'dana.park@northwind.example','Bulk accessory purchase, docking stations','approved','2026-05-30 11:00-04','2026-06-02 10:00-04','Within budget'),
  ('APR-3414', NULL,'avery.chen@northwind.example','Replacement laptop request for Devon Brooks','denied','2026-05-22 14:00-04','2026-05-24 09:00-04','Unit not yet past refresh cycle')
) AS v(num, wf, approver_email, summary, status, sub, dec, notes)
LEFT JOIN workflows w ON w.workflow_number = v.wf
JOIN app_users ap ON ap.email = v.approver_email
ON CONFLICT (approval_number) DO NOTHING;

-- ── Audit activity (spread across recent weeks for a live feed) ──────────────
INSERT INTO audit_log (audit_number, actor_user_id, actor_label, action, record_type, record_id, result, metadata, created_at)
SELECT v.num, u.id, u.display_name, v.action, v.rtype, v.rid, v.result, '{"source":"seed"}'::jsonb, (v.at)::timestamptz
FROM (VALUES
  ('AUD-DM0001','jordan.rivera@northwind.example','Created computer asset','asset','NWA-CMP-20019','Logged','2026-05-19 09:12-04'),
  ('AUD-DM0002','jordan.rivera@northwind.example','Created computer asset','asset','NWA-CMP-20018','Logged','2026-05-19 09:14-04'),
  ('AUD-DM0003','logan.kim@northwind.example','Transferred computer custody','asset','NWA-CMP-20011','Logged','2026-05-21 13:31-04'),
  ('AUD-DM0004','dana.park@northwind.example','Approved request','approval','APR-3413','Completed','2026-06-02 10:00-04'),
  ('AUD-DM0005','avery.chen@northwind.example','Denied request','approval','APR-3414','Completed','2026-05-24 09:00-04'),
  ('AUD-DM0006','jordan.rivera@northwind.example','Recorded maintenance','asset','NWA-CMP-20003','Logged','2026-05-12 10:05-04'),
  ('AUD-DM0007','jordan.rivera@northwind.example','Issued accessory','accessory','Wireless Mouse','Logged','2026-05-26 15:40-04'),
  ('AUD-DM0008','logan.kim@northwind.example','Issued consumable','consumable','Toner Cartridge 58A','Logged','2026-05-28 11:10-04'),
  ('AUD-DM0009','dana.park@northwind.example','Dispositioned computer asset','asset','NWA-CMP-20024','Logged','2026-03-18 14:00-04'),
  ('AUD-DM0010','dana.park@northwind.example','Dispositioned computer asset','asset','NWA-CMP-20023','Logged','2026-04-30 15:00-04'),
  ('AUD-DM0011','jordan.rivera@northwind.example','Checked in computer asset','asset','NWA-CMP-20015','Logged','2026-06-01 09:00-04'),
  ('AUD-DM0012','jordan.rivera@northwind.example','Recorded maintenance','asset','NWA-CMP-20020','Logged','2026-06-02 09:30-04'),
  ('AUD-DM0013','logan.kim@northwind.example','Recorded maintenance','asset','NWA-CMP-20021','Logged','2026-06-05 10:15-04'),
  ('AUD-DM0014','jordan.rivera@northwind.example','Created computer asset','asset','NWA-CMP-20012','Logged','2026-06-07 08:20-04'),
  ('AUD-DM0015','jordan.rivera@northwind.example','Issued computer asset','asset','NWA-CMP-20013','Logged','2026-06-08 14:45-04'),
  ('AUD-DM0016','dana.park@northwind.example','Updated custom field','custom_field','fisma-system','Logged','2026-06-09 10:30-04'),
  ('AUD-DM0017','jordan.rivera@northwind.example','Transferred computer custody','asset','NWA-CMP-20022','Logged','2026-06-09 15:05-04'),
  ('AUD-DM0018','avery.chen@northwind.example','Approved request','approval','APR-3411','Completed','2026-06-06 09:30-04')
) AS v(num, actor_email, action, rtype, rid, result, at)
JOIN app_users u ON u.email = v.actor_email
ON CONFLICT (audit_number) DO NOTHING;

-- ── Accessory checkouts / consumable issues / component assignments ──────────
INSERT INTO accessory_checkouts (accessory_id, assigned_user_id, notes)
SELECT acc.id, u.id, v.notes
FROM (VALUES
  ('Wireless Mouse','sarah.lindgren@northwind.example','Standard issue'),
  ('Wireless Mouse','marcus.webb@northwind.example','Standard issue'),
  ('USB-C Dock','elena.castillo@northwind.example','Field laptop dock'),
  ('USB-C Dock','nina.petrov@northwind.example','Desk setup'),
  ('YubiKey 5 NFC','grace.okafor@northwind.example','Security key')
) AS v(acc_name, user_email, notes)
JOIN accessories acc ON acc.name = v.acc_name
JOIN app_users u ON u.email = v.user_email
WHERE NOT EXISTS (
  SELECT 1 FROM accessory_checkouts x WHERE x.accessory_id = acc.id AND x.assigned_user_id = u.id
);

INSERT INTO consumable_issues (consumable_id, assigned_user_id, notes)
SELECT con.id, u.id, v.notes
FROM (VALUES
  ('Toner Cartridge 58A','devon.brooks@northwind.example','Printer refill'),
  ('AA Batteries (pack)','omar.haddad@northwind.example','Field equipment'),
  ('Evidence Bags (large)','victor.reyes@northwind.example','Case intake'),
  ('AA Batteries (pack)','theo.walsh@northwind.example','Field equipment')
) AS v(con_name, user_email, notes)
JOIN consumables con ON con.name = v.con_name
JOIN app_users u ON u.email = v.user_email
WHERE NOT EXISTS (
  SELECT 1 FROM consumable_issues x WHERE x.consumable_id = con.id AND x.assigned_user_id = u.id
);

INSERT INTO component_assignments (component_id, asset_id, assigned_qty, notes)
SELECT comp.id, a.id, v.qty, v.notes
FROM (VALUES
  ('16GB DDR5 SODIMM','NWA-CMP-20003', 2,'Upgraded to 32GB total'),
  ('1TB NVMe SSD','NWA-CMP-20012', 1,'Storage expansion'),
  ('16GB DDR5 SODIMM','NWA-CMP-20012', 1,'Additional memory'),
  ('1TB NVMe SSD','NWA-CMP-20013', 1,'Pre-deployment build')
) AS v(comp_name, tag, qty, notes)
JOIN components comp ON comp.name = v.comp_name
JOIN assets a ON a.asset_tag = v.tag
WHERE NOT EXISTS (
  SELECT 1 FROM component_assignments x WHERE x.component_id = comp.id AND x.asset_id = a.id
);
