export const assetStats = [
  { label: "Tracked assets", value: "11,000", detail: "legacy records targeted for migration" },
  { label: "Computer assets", value: "3,248", detail: "Active operating module", tone: "success" },
  { label: "Pending returns", value: "37", detail: "Offboarding recovery needs action", tone: "warn" },
  { label: "High sensitivity", value: "418", detail: "Firearms access flag required", tone: "danger" }
];

export const categoryRollup = [
  { category: "Computers", count: "3,248", status: "In build", tone: "green" },
  { category: "Firearms", count: "418", status: "Access gated", tone: "red" },
  { category: "Vehicles", count: "286", status: "Planned", tone: "yellow" },
  { category: "Radios", count: "1,104", status: "Planned", tone: "yellow" },
  { category: "Cell phones", count: "2,972", status: "Planned", tone: "gray" },
  { category: "Investigative equipment", count: "2,972", status: "Planned", tone: "cyan" }
];

export const computerAssets = [
  {
    id: "NWA-CMP-10482",
    type: "Laptop",
    serial: "MXC4D73KQ2",
    custodian: "Avery Chen",
    office: "Atlanta Field Office",
    status: "Assigned",
    lastAction: "Custody transfer",
    sensitivity: "Standard"
  },
  {
    id: "NWA-CMP-10811",
    type: "Laptop",
    serial: "MXC9Q14LZ8",
    custodian: "Unassigned",
    office: "Headquarters",
    status: "Available",
    lastAction: "Returned from offboarding",
    sensitivity: "Standard"
  },
  {
    id: "NWA-CMP-09102",
    type: "Desktop",
    serial: "DTK2A45LM1",
    custodian: "Marcus Hill",
    office: "Dallas Field Office",
    status: "Needs approval",
    lastAction: "Supervisor review requested",
    sensitivity: "Standard"
  },
  {
    id: "NWA-CMP-11732",
    type: "Tablet",
    serial: "TBX7F80A22",
    custodian: "Priya Shah",
    office: "New York Field Office",
    status: "In transfer",
    lastAction: "Pickup scheduled",
    sensitivity: "Standard"
  }
];

export const workflows = [
  {
    id: "WF-2026-0412",
    title: "New agent computer issuance",
    owner: "Jordan Rivera",
    person: "Avery Chen",
    stage: "Supervisor approval",
    status: "In review",
    due: "May 14, 2026"
  },
  {
    id: "WF-2026-0410",
    title: "Offboarding asset recovery",
    owner: "Jordan Rivera",
    person: "Sam Patel",
    stage: "Pickup coordination",
    status: "At risk",
    due: "May 12, 2026"
  },
  {
    id: "WF-2026-0408",
    title: "Laptop custody transfer",
    owner: "Renee Long",
    person: "Marcus Hill",
    stage: "Asset manager action",
    status: "Ready",
    due: "May 15, 2026"
  }
];

export const workflowStages = [
  {
    name: "HRIS trigger",
    summary: "New or departing employee event enters the queue.",
    count: "8"
  },
  {
    name: "Requirement capture",
    summary: "Agent equipment needs are collected inside the system.",
    count: "12"
  },
  {
    name: "Approval",
    summary: "Supervisor or delegated approver reviews the request.",
    count: "6"
  },
  {
    name: "Custody action",
    summary: "Asset manager issues, transfers, or recovers property.",
    count: "14"
  }
];

export const approvals = [
  {
    id: "APR-3381",
    request: "Computer issuance for Avery Chen",
    approver: "Dana Williams",
    office: "Atlanta Field Office",
    type: "Onboarding",
    submitted: "May 11, 2026",
    status: "Pending"
  },
  {
    id: "APR-3379",
    request: "Laptop transfer to Marcus Hill",
    approver: "Leah Brooks",
    office: "Dallas Field Office",
    type: "Transfer",
    submitted: "May 10, 2026",
    status: "Pending"
  },
  {
    id: "APR-3372",
    request: "Vehicle disposition review",
    approver: "Terry Martin",
    office: "Headquarters",
    type: "Disposition",
    submitted: "May 9, 2026",
    status: "Escalated"
  }
];

export const auditEntries = [
  {
    id: "AUD-900182",
    timestamp: "2026-05-12 09:18 ET",
    actor: "Jordan Rivera",
    action: "Created custody transfer",
    record: "NWA-CMP-11732",
    result: "Logged"
  },
  {
    id: "AUD-900181",
    timestamp: "2026-05-12 08:42 ET",
    actor: "System",
    action: "HRIS onboarding event received",
    record: "WF-2026-0412",
    result: "Logged"
  },
  {
    id: "AUD-900180",
    timestamp: "2026-05-11 16:27 ET",
    actor: "Dana Williams",
    action: "Supervisor approval requested",
    record: "APR-3381",
    result: "Logged"
  },
  {
    id: "AUD-900179",
    timestamp: "2026-05-11 14:03 ET",
    actor: "Migration utility",
    action: "Validation row held for review",
    record: "FM-LEGACY-2218",
    result: "Review queue"
  }
];

export const roleMatrix = [
  { role: "Admin", scope: "Full platform configuration", firearmAccess: "By flag only" },
  { role: "Asset Manager", scope: "Create, transfer, and disposition assets", firearmAccess: "By flag only" },
  { role: "Office Asset Manager", scope: "Scoped to office or sub-group", firearmAccess: "By flag only" },
  { role: "Approver", scope: "Approve or deny routed requests", firearmAccess: "No custody edits" },
  { role: "Read-Only", scope: "Audit and leadership reporting", firearmAccess: "Masked by default" }
];
