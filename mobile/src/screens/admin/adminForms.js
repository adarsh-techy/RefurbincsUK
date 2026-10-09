// Field definitions for every admin create/edit form in the app — the same
// fields, defaults and API calls as the web forms (ClientForm, StaffForm,
// PartForm, ServiceForm, IssueReasonForm, UserForm, InvoicesPage,
// RecycleClientForm). AdminFormScreen renders any of these.
//
// field: { key, label, type, required, placeholder, options, help,
//          editOnly, createOnly, capitalize, accept }
// types: text | email | number | password | multiline | select | toggle |
//        multiselect | file | date
// toPayload(values, { isEdit }) → plain object; any File field makes the
// request multipart automatically.

export const ADMIN_PERMISSIONS = [
  { value: 'truck_intakes', label: 'Truck Intake' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'staff', label: 'Staff' },
  { value: 'parts', label: 'Inventory' },
  { value: 'returns', label: 'Returns' },
  { value: 'recycle', label: 'Recycle' },
  { value: 'audit_logs', label: 'Audit Log' },
  { value: 'clients', label: 'Clients' },
  { value: 'issue_reasons', label: 'Issue Reasons' },
  { value: 'services', label: 'Services' },
];

export const CLIENT_MODULES = [
  { value: 'client_dashboard', label: 'Dashboard' },
  { value: 'client_all_batteries', label: 'All Batteries' },
  { value: 'client_packed', label: 'Packed' },
  { value: 'client_received', label: 'Received' },
  { value: 'client_battery_sorting', label: 'Battery Sorting' },
  { value: 'client_invoices', label: 'Invoices' },
  { value: 'client_transactions', label: 'Transactions' },
  { value: 'client_support', label: 'Support & Chat' },
  { value: 'client_notifications', label: 'Notifications' },
];

const capWords = true;

export const ADMIN_FORMS = {
  client: {
    title: 'Fleet Client',
    endpoint: '/clients',
    deletable: true,
    fields: [
      { key: 'name', label: 'Client name', type: 'text', required: true, capitalize: capWords, placeholder: 'e.g. Apex Fleet Logistics UK' },
      { key: 'invoiceEmail', label: 'Invoice email', type: 'email', placeholder: 'accounts@client.com' },
      { key: 'logo', label: 'Logo (PNG/JPG/WEBP)', type: 'file', accept: ['image/png', 'image/jpeg', 'image/webp'] },
      { key: 'email', label: 'Portal login email', type: 'email', help: 'Gives the client a portal login. Leave empty for no login.' },
      { key: 'tempPassword', label: 'Temporary password', type: 'password', help: 'Min 8 characters. They must change it on first login.' },
      { key: 'permissions', label: 'Portal modules', type: 'multiselect', options: CLIENT_MODULES, help: 'None selected = all modules.' },
      { key: 'active', label: 'Login active', type: 'toggle', editOnly: true },
    ],
    fromRow: (r) => ({
      name: r.name || '',
      invoiceEmail: r.invoice_email || '',
      email: r.login_email || '',
      permissions: Array.isArray(r.user_permissions) ? r.user_permissions : [],
      active: r.user_active !== false,
    }),
    toPayload: (v, { isEdit }) => ({
      name: v.name.trim(),
      invoiceEmail: v.invoiceEmail.trim() || undefined,
      email: v.email.trim() || undefined,
      tempPassword: v.tempPassword || undefined,
      permissions: JSON.stringify(v.permissions || []),
      ...(isEdit ? { active: String(v.active !== false) } : {}),
      logo: v.logo || undefined,
    }),
  },

  recycleClient: {
    title: 'Recycling Partner',
    endpoint: '/clients',
    deletable: true,
    fields: [
      { key: 'name', label: 'Partner name', type: 'text', required: true, capitalize: capWords },
      { key: 'invoiceEmail', label: 'Contact / invoice email', type: 'email' },
      { key: 'email', label: 'Portal login email', type: 'email' },
      { key: 'tempPassword', label: 'Temporary password', type: 'password', help: 'Min 8 characters.' },
      { key: 'active', label: 'Login active', type: 'toggle', editOnly: true },
    ],
    fromRow: (r) => ({ name: r.name || '', invoiceEmail: r.invoice_email || '', email: r.login_email || '', active: r.user_active !== false }),
    toPayload: (v, { isEdit }) => ({
      name: v.name.trim(),
      invoiceEmail: v.invoiceEmail.trim() || undefined,
      email: v.email.trim() || undefined,
      tempPassword: v.tempPassword || undefined,
      role: 'recycle_client',
      ...(isEdit ? { active: String(v.active !== false) } : {}),
    }),
  },

  staff: {
    title: 'Staff Member',
    endpoint: '/staff',
    deletable: true,
    fields: [
      { key: 'name', label: 'Staff full name', type: 'text', required: true, capitalize: capWords },
      { key: 'role', label: 'Workshop role', type: 'select', required: true, options: [{ value: 'technician', label: 'Technician — repairs only' }, { value: 'supervisor', label: 'Supervisor — repairs & testing sign-off' }] },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'email', label: 'Email (also the login)', type: 'email' },
      { key: 'tempPassword', label: 'Temporary password', type: 'password', createOnly: true, help: 'Fill to create a login. Min 8 characters.' },
      { key: 'salary', label: 'Salary (£)', type: 'number' },
      { key: 'passportNumber', label: 'Passport number', type: 'text' },
      { key: 'niNumber', label: 'NI number', type: 'text' },
      { key: 'shareCode', label: 'Share code', type: 'text' },
      { key: 'docFile', label: 'ID / right-to-work document', type: 'file', accept: ['application/pdf', 'image/*'] },
    ],
    fromRow: (r) => ({
      name: r.name || '', role: r.role || 'technician', phone: r.phone || '', email: r.email || r.login_email || '',
      salary: r.salary != null ? String(r.salary) : '', passportNumber: r.passport_number || '', niNumber: r.ni_number || '', shareCode: r.share_code || '',
    }),
    toPayload: (v) => ({
      name: v.name.trim(), role: v.role, phone: v.phone.trim() || undefined, email: v.email.trim() || undefined,
      tempPassword: v.tempPassword || undefined, salary: v.salary !== '' ? v.salary : undefined,
      passportNumber: v.passportNumber.trim() || undefined, niNumber: v.niNumber.trim() || undefined, shareCode: v.shareCode.trim() || undefined,
      docFile: v.docFile || undefined,
    }),
    defaults: { role: 'technician' },
  },

  part: {
    title: 'Part',
    endpoint: '/parts',
    deletable: true,
    fields: [
      { key: 'name', label: 'Part name', type: 'text', required: true, capitalize: capWords },
      { key: 'sku', label: 'SKU', type: 'text' },
      { key: 'quantity', label: 'Quantity in stock', type: 'number', required: true },
      { key: 'repairCost', label: 'Part cost (£)', type: 'number' },
      { key: 'serviceCharge', label: 'Labour / service charge (£)', type: 'number' },
    ],
    fromRow: (r) => ({ name: r.name || '', sku: r.sku || '', quantity: String(r.quantity ?? 0), repairCost: String(r.repair_cost ?? 0), serviceCharge: String(r.service_charge ?? 0) }),
    toPayload: (v) => ({ name: v.name.trim(), sku: v.sku.trim() || undefined, quantity: Number(v.quantity) || 0, repairCost: Number(v.repairCost) || 0, serviceCharge: Number(v.serviceCharge) || 0 }),
    defaults: { quantity: '0', repairCost: '0', serviceCharge: '0' },
  },

  service: {
    title: 'Service',
    endpoint: '/services',
    nextOrderFrom: '/services',
    deletable: true,
    fields: [
      { key: 'name', label: 'Service name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'multiline' },
      { key: 'rate', label: 'Rate (£)', type: 'number', required: true },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
      { key: 'is_mandatory', label: 'Mandatory on every intake', type: 'toggle' },
      { key: 'active', label: 'Active', type: 'toggle' },
    ],
    fromRow: (r) => ({ name: r.name || '', description: r.description || '', rate: String(r.rate ?? 0), sortOrder: String(r.sort_order ?? 0), is_mandatory: Boolean(r.is_mandatory), active: r.active !== false }),
    toPayload: (v) => ({ name: v.name.trim(), description: v.description.trim(), rate: Number(v.rate) || 0, sortOrder: Number(v.sortOrder) || 0, is_mandatory: Boolean(v.is_mandatory), active: v.active !== false }),
    defaults: { rate: '0', sortOrder: '0', active: true },
  },

  issueReason: {
    title: 'Issue Reason',
    endpoint: '/issue-reasons',
    nextOrderFrom: '/issue-reasons',
    deletable: true,
    fields: [
      { key: 'label', label: 'Reason', type: 'text', required: true, capitalize: capWords },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
      { key: 'active', label: 'Active', type: 'toggle' },
    ],
    fromRow: (r) => ({ label: r.label || '', sortOrder: String(r.sort_order ?? 0), active: r.active !== false }),
    toPayload: (v) => ({ label: v.label.trim(), sortOrder: Number(v.sortOrder) || 0, active: v.active !== false }),
    defaults: { sortOrder: '0', active: true },
  },

  user: {
    title: 'User Account',
    endpoint: '/users',
    deletable: true,
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true, capitalize: capWords },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'password', createOnly: true, required: true, help: 'Min 8 characters.' },
      { key: 'role', label: 'Role', type: 'select', required: true, options: [{ value: 'admin', label: 'Admin (selected modules)' }, { value: 'super_admin', label: 'Super Admin (everything)' }] },
      { key: 'permissions', label: 'Admin modules', type: 'multiselect', options: ADMIN_PERMISSIONS, help: 'Only used for the Admin role.' },
      { key: 'active', label: 'Active', type: 'toggle', editOnly: true },
    ],
    fromRow: (r) => ({ name: r.name || '', email: r.email || '', role: r.role || 'admin', permissions: Array.isArray(r.permissions) ? r.permissions : [], active: r.active !== false }),
    toPayload: (v, { isEdit }) => ({
      name: v.name.trim(), email: v.email.trim(), role: v.role,
      permissions: v.role === 'admin' ? v.permissions || [] : [],
      ...(isEdit ? { active: v.active !== false } : { password: v.password }),
    }),
    defaults: { role: 'admin', permissions: [] },
  },

  invoice: {
    title: 'Invoice',
    endpoint: '/invoices',
    deletable: true,
    fields: [
      { key: 'clientId', label: 'Client', type: 'select', required: true, optionsFrom: 'clients' },
      { key: 'title', label: 'Invoice number / title', type: 'text', placeholder: 'Defaults to the file name' },
      { key: 'amount', label: 'Amount (£)', type: 'number', required: true },
      { key: 'status', label: 'Status', type: 'select', options: [{ value: 'sent', label: 'Sent' }, { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' }, { value: 'draft', label: 'Draft' }] },
      { key: 'issueDate', label: 'Issue date', type: 'date' },
      { key: 'dueDate', label: 'Due date', type: 'date' },
      { key: 'notes', label: 'Notes', type: 'multiline' },
      { key: 'pdfFile', label: 'Invoice PDF / image', type: 'file', required: true, createRequiredOnly: true, accept: ['application/pdf', 'image/*'] },
      { key: 'sendEmail', label: 'Email it to the client now', type: 'toggle', createOnly: true },
    ],
    fromRow: (r) => ({
      clientId: r.client_id ? String(r.client_id) : '', title: r.invoice_number || '', amount: String(r.amount ?? ''), status: r.status || 'sent',
      issueDate: r.issue_date ? String(r.issue_date).slice(0, 10) : '', dueDate: r.due_date ? String(r.due_date).slice(0, 10) : '', notes: r.notes || '',
    }),
    toPayload: (v) => ({
      clientId: v.clientId, title: v.title.trim() || undefined, amount: v.amount, currency: 'GBP', status: v.status || 'sent',
      issueDate: v.issueDate || undefined, dueDate: v.dueDate || undefined, notes: v.notes.trim() || undefined,
      sendEmail: v.sendEmail ? 'true' : undefined, pdfFile: v.pdfFile || undefined,
    }),
    defaults: { status: 'sent', issueDate: new Date().toISOString().slice(0, 10) },
  },
};
