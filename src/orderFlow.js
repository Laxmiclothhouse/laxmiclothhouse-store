// ─────────────────────────────────────────────────────────────
// orderFlow.js — Single source of truth for the order pipeline,
// staff roles, role-based transitions and payment badges.
// (Plan steps 1, 2 & 4: canonical statuses, roles, workflow guards)
// ─────────────────────────────────────────────────────────────

/** The main forward pipeline (in display order). */
export const FLOW = [
  { status: 'placed', label: 'Order Placed', color: '#8a6df0' },
  { status: 'confirmed', label: 'Confirmed', color: '#b06d16' },
  { status: 'packed', label: 'Packed', color: '#7a4fa3' },
  { status: 'shipped', label: 'Shipped', color: '#146c64' },
  { status: 'delivered', label: 'Delivered', color: '#1f7a4d' },
];

/** Statuses that are not part of the forward flow. */
export const EXTRA_STATUSES = [
  { status: 'cancelled', label: 'Cancelled', color: '#8a8a8a' },
];

export const ALL_STATUSES = [...FLOW, ...EXTRA_STATUSES];
export const TERMINAL_STATUSES = ['delivered', 'cancelled'];

/** Resolve label/colour for any stored status (incl. legacy "paid"). */
export function statusMeta(status) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'paid') return { status: 'paid', label: 'Paid', color: '#1f7a4d' };
  const found = ALL_STATUSES.find((s) => s.status === raw);
  return found || { status: raw, label: raw.toUpperCase(), color: '#8a8a8a' };
}

/** Index inside FLOW (for the step timeline). -1 when not in the flow. */
export function flowStepIndex(status) {
  return FLOW.findIndex((s) => s.status === String(status || '').toLowerCase());
}

// ── Roles ───────────────────────────────────────────────────
export const ROLES = ['admin', 'manager', 'packer', 'shipper', 'support', 'customer'];

export const STAFF_ROLES = ['admin', 'manager', 'packer', 'shipper', 'support'];

export const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  packer: 'Packer',
  shipper: 'Shipper',
  support: 'Support',
  customer: 'Customer',
};

export const isStaffRole = (role) => STAFF_ROLES.includes(String(role || '').toLowerCase());

// ── Allowed state machine ───────────────────────────────────
export const TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'], // 'paid' orders count as confirmed
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Fields that MUST be provided before a status is applied. */
export const REQUIRED_FIELDS = {
  shipped: ['trackingNo'],
};

const ROLE_RANK = { admin: 5, manager: 4, shipper: 3, packer: 2, support: 1, customer: 0 };

/**
 * Can this staff role move an order from `current` to `target`?
 * admin/manager = full pipeline; packer = pack only; shipper = ship only.
 */
export function canTransition(current, target, role) {
  let from = String(current || '').toLowerCase();
  if (from === 'paid') from = 'confirmed';
  if (!from || !target || from === target) return false;
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(target)) return false;
  const rank = ROLE_RANK[String(role || '').toLowerCase()] || 0;
  if (rank >= 4) return true;
  if (role === 'packer' && target === 'packed') return true;
  if (role === 'shipper' && target === 'shipped') return true;
  return false;
}

/** Next statuses this role may apply to an order right now. */
export function nextStatuses(current, role) {
  const from = String(current || '').toLowerCase();
  if (from === 'paid') return TRANSITIONS['confirmed'] || [];
  return (TRANSITIONS[from] || []).filter((t) => canTransition(from, t, role));
}

// ── Role-scoped queues ──────────────────────────────────────
// Packers only see orders waiting to be packed; shippers only see
// orders waiting to be shipped. Admin/manager/support see everything.
// Legacy "paid" orders count as confirmed (waiting to be packed).
export function roleQueueScope(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'packer') {
    return {
      statuses: ['confirmed', 'paid'],
      title: 'Orders to pack',
      empty: 'No orders waiting to be packed. Newly confirmed orders appear here automatically.',
    };
  }
  if (r === 'shipper') {
    return {
      statuses: ['packed'],
      title: 'Orders to ship',
      empty: 'No orders waiting to be shipped. Packed orders appear here automatically.',
    };
  }
  return null;
}

// ── Payment badge helpers ───────────────────────────────────
export function payMeta(order) {
  const o = order || {};
  const mode = String((o.payment && o.payment.mode) || 'upi').toLowerCase();
  const paid = o.payment ? o.payment.status === 'paid' : mode !== 'cod';
  return {
    mode,
    paid,
    label: paid ? (mode === 'cod' ? 'COD · PAID' : 'PAID') : (mode === 'cod' ? 'COD · PENDING' : 'PAYMENT PENDING'),
    cls: paid ? 'paid' : 'pending',
  };
}

/** Compact audit "who" record built from a session user. */
export function auditBy(user) {
  if (!user) return null;
  return {
    uid: user.id || user.uid,
    name: user.name || user.email || 'staff',
    email: user.email,
    role: user.role || 'staff',
  };
}
