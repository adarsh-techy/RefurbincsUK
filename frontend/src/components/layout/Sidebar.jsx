import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { hasPermission, hasClientPermission } from '../../utils/permissions';
import { logout } from '../../features/auth/auth-slice';
import { useTheme } from '../../context/ThemeContext';
import apiClient from '../../services/api-client';
import { socket } from '../../services/socket-client';
import refurbnicsLogo from '../../assets/Refurbnics.png';
import logoUrl from '../../utils/logo-url';

// ── SVG Icon Registry for Classic Visual Polish ─────────────────────────────
const Icons = {
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  ),
  messages: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  ),
  support: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  ),
  notifications: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  intake: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  ),
  battery: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <rect width="16" height="10" x="2" y="7" rx="2" ry="2" />
      <line x1="22" x2="22" y1="11" y2="13" />
    </svg>
  ),
  qrcode: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <rect width="5" height="5" x="3" y="3" rx="1" />
      <rect width="5" height="5" x="16" y="3" rx="1" />
      <rect width="5" height="5" x="3" y="16" rx="1" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <path d="M21 21v.01" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <path d="M3 12h.01" />
      <path d="M12 3h.01" />
      <path d="M12 16v.01" />
      <path d="M16 12h1" />
      <path d="M21 12v.01" />
      <path d="M12 21v-1" />
    </svg>
  ),
  repairs: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  returns: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  unserviceable: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  ),
  recycle: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
      <path d="M11 19h8.2a1.8 1.8 0 0 0 1.57-.881 1.785 1.785 0 0 0 .004-1.784L17 9.5" />
      <path d="M11 4.5h2a1.8 1.8 0 0 1 1.57.881l3.955 6.868" />
      <path d="m3 16 3 3-3 3" />
      <path d="m14 2 3 3-3 3" />
    </svg>
  ),
  staff: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  inventory: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  clients: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  ),
  issues: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  ),
  audit: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  finance: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  ),
  profile: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  stage1: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-amber-500">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  ),
  stage2: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-blue-500">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  invoice: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  sorting: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M11 5h10" />
      <path d="M11 9h7" />
      <path d="M11 13h4" />
      <path d="m3 17 3 3 3-3" />
      <path d="M6 18V4" />
    </svg>
  ),
  history: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
  stage3: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-emerald-500">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  ratings: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  certificates: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
};

// ── Role-Specific Categorized Navigation Menus ──────────────────────────────
const CLIENT_NAV_GROUPS = [
  {
    heading: 'Overview',
    links: [
      { to: '/', label: 'Dashboard', icon: Icons.dashboard, end: true, clientPermission: 'client_dashboard' },
      { to: '/my/history', label: 'History & Activity', icon: Icons.history },
      { to: '/my/batteries/all', label: 'All Batteries', icon: Icons.battery, clientPermission: 'client_all_batteries' },
    ],
  },
  {
    heading: 'Repair Service',
    links: [
      { to: '/my/batteries/packed', label: 'Packed', icon: Icons.stage1, clientPermission: 'client_packed' },
      { to: '/my/batteries/pending', label: 'In Service', icon: Icons.stage2, clientPermission: 'client_in_service' },
      { to: '/my/batteries/received', label: 'Received', icon: Icons.stage3, clientPermission: 'client_received' },
    ],
  },
  {
    heading: 'Sorting',
    links: [
      { to: '/my/battery-sorting', label: 'Battery Sorting', icon: Icons.sorting, clientPermission: 'client_battery_sorting' },
    ],
  },
  {
    heading: 'Billing',
    links: [
      { to: '/my/invoices', label: 'Invoices', icon: Icons.invoice, clientPermission: 'client_invoices' },
      { to: '/my/transactions', label: 'Transactions', icon: Icons.finance, clientPermission: 'client_transactions' },
    ],
  },
  {
    heading: 'Sustainability',
    links: [
      { to: '/my/certificates', label: 'Milestones & Impact', icon: Icons.certificates },
    ],
  },
  {
    heading: 'Support',
    links: [
      { to: '/my/support', label: 'Support', icon: Icons.support, clientPermission: 'client_support' },
      { to: '/my/notifications', label: 'Notifications', icon: Icons.notifications, clientPermission: 'client_notifications' },
      { to: '/my/profile', label: 'Profile', icon: Icons.profile },
    ],
  },
];

const RECYCLE_CLIENT_NAV_GROUPS = [
  {
    heading: 'Overview',
    links: [
      { to: '/', label: 'Dashboard', icon: Icons.dashboard, end: true },
      { to: '/my/support', label: 'Support', icon: Icons.support },
    ],
  },
  {
    heading: 'Logistics',
    links: [
      { to: '/my/recycle-shipments', label: 'Shipments', icon: Icons.recycle },
    ],
  },
  {
    heading: 'Settings',
    links: [
      { to: '/my/profile', label: 'Profile', icon: Icons.profile },
    ],
  },
];

const NAV_GROUPS = [
  {
    heading: 'Overview',
    links: [
      { to: '/', label: 'Dashboard', icon: Icons.dashboard, end: true },
      { to: '/messages', label: 'Messages', icon: Icons.messages },
    ],
  },
  {
    heading: 'Operations',
    links: [
      { to: '/truck-intakes', label: 'Intake', icon: Icons.intake, permission: 'truck_intakes' },
      { to: '/batteries', label: 'Battery Fleet', icon: Icons.battery, end: true },
      { to: '/batteries-qr-code', label: 'QR Codes', icon: Icons.qrcode },
      { to: '/repairs', label: 'Repairs', icon: Icons.repairs, permission: 'repairs' },
      { to: '/returns', label: 'Returns', icon: Icons.returns, permission: 'returns' },
    ],
  },
  {
    heading: 'Recycling',
    links: [
      { to: '/batteries/unserviceable', label: 'Unserviceable', icon: Icons.unserviceable },
      { to: '/recycle', label: 'Recycle Shipments', icon: Icons.recycle, permission: 'recycle' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { to: '/clients', label: 'Fleet Clients', icon: Icons.clients, permission: 'clients' },
      { to: '/recycle-clients', label: 'Recycle Clients', icon: Icons.clients, permission: 'clients' },
      { to: '/parts', label: 'Parts', icon: Icons.inventory, permission: 'parts' },
      { to: '/staff', label: 'Staff', icon: Icons.staff, permission: 'staff' },
      { to: '/issue-reasons', label: 'Issue Reasons', icon: Icons.issues, permission: 'issue_reasons' },
    ],
  },
  {
    heading: 'Administration',
    links: [
      { to: '/ratings', label: 'Ratings & Reviews', icon: Icons.ratings },
      { to: '/certificates', label: 'Certificates & Impact', icon: Icons.certificates },
      { to: '/invoices', label: 'Invoices', icon: Icons.invoice },
      { to: '/finance', label: 'Finance', icon: Icons.finance, superAdminOnly: true },
      { to: '/users', label: 'Users', icon: Icons.users, superAdminOnly: true },
      { to: '/audit-logs', label: 'Audit Log', icon: Icons.audit, permission: 'audit_logs' },
    ],
  },
];

function initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function SidebarNav({ visibleGroups, user, onLinkClick, onLogout, customTheme }) {
  const isAccentBg = !!customTheme?.applyToSidebar;
  const accent = customTheme?.accentColor || '#10b981';
  // A client with their own uploaded logo sees that instead of the
  // Refurbinics brand mark, every page, not just their dashboard — that's
  // the one place every client actually looks at repeatedly.
  const clientLogo = user?.role === 'client' ? logoUrl(user?.client_logo_path) : null;

  return (
    <div className="flex h-full flex-col justify-between">
      {/* ── Brand Logo Header ────────────────────────────────────────── */}
      <div>
        <div className="flex h-20 items-center px-6">
          {clientLogo ? (
            <img
              src={clientLogo}
              alt={user?.name || 'Client logo'}
              className="max-h-8 max-w-[130px] w-auto object-contain"
            />
          ) : (
            <Link to="/" className="flex items-center">
              <img
                src={refurbnicsLogo}
                alt="Refurbinics"
                className={`max-h-10 max-w-[175px] w-auto object-contain transition-transform hover:scale-102 ${
                  isAccentBg ? 'brightness-0 invert' : ''
                }`}
              />
            </Link>
          )}
        </div>

        <div className={`mx-5 border-t ${isAccentBg ? 'border-white/20' : 'border-slate-100 dark:border-white/5'}`} />
      </div>

      {/* ── Navigation Links Scroll List ─────────────────────────────── */}
      <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-3.5 py-4">
        {visibleGroups.map((group, i) => (
          <div key={group.heading || `group-${i}`}>
            {group.heading && (
              <p
                className={`mb-2 px-3 text-xs font-bold uppercase tracking-wider ${
                  isAccentBg ? 'text-white/80' : 'text-slate-400 dark:text-slate-400'
                }`}
              >
                {group.heading}
              </p>
            )}
            <div className="flex flex-col gap-1">
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={onLinkClick}
                  style={({ isActive }) =>
                    isAccentBg
                      ? isActive
                        ? { backgroundColor: 'rgba(255, 255, 255, 0.22)', color: '#ffffff' }
                        : {}
                      : isActive
                        ? { backgroundColor: `${accent}18`, color: accent }
                        : {}
                  }
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                      isAccentBg
                        ? isActive
                          ? 'text-white shadow-xs font-bold'
                          : 'text-white/85 hover:bg-white/10 hover:text-white'
                        : isActive
                          ? 'text-slate-900 dark:text-white shadow-2xs font-bold'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-200 dark:hover:bg-white/5 dark:hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Active Left Indicator Pill */}
                      {isActive && (
                        <span
                          className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full"
                          style={{ backgroundColor: isAccentBg ? '#ffffff' : accent }}
                        />
                      )}

                      {/* Label */}
                      <span className="truncate">{link.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User Profile Footer ──────────────────────────────────────── */}
      <div className={`shrink-0 border-t p-3.5 ${isAccentBg ? 'border-white/20' : 'border-slate-100 dark:border-white/5'}`}>
        <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl bg-slate-50/80 p-2 dark:bg-white/5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-xs"
            style={{ backgroundColor: isAccentBg ? 'rgba(255, 255, 255, 0.3)' : accent }}
          >
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-xs font-extrabold ${isAccentBg ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              {user?.name || 'User'}
            </p>
            <p className={`truncate text-[10px] font-bold uppercase tracking-wider ${isAccentBg ? 'text-white/70' : 'text-slate-400 dark:text-neutral-500'}`}>
              {user?.role === 'client' ? 'Fleet Client' : user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all ${
            isAccentBg
              ? 'bg-white/15 text-white hover:bg-red-500/90'
              : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-300'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l2.47-2.47a.75.75 0 1 0-1.06-1.06l-3.75 3.75a.75.75 0 0 0 0 1.06l3.75 3.75a.75.75 0 1 0 1.06-1.06l-2.47-2.47H18.25c.414 0 .75-.336.75-.75Z" clipRule="evenodd" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

function Sidebar({ mobileOpen = false, onClose = () => {} }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { customTheme, theme } = useTheme();

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onClose]);

  function isVisible(link) {
    if (link.superAdminOnly) return user?.role === 'super_admin';
    if (user?.role === 'client' && link.clientPermission) {
      return hasClientPermission(user, link.clientPermission);
    }
    if (link.permission) return hasPermission(user, link.permission);
    return true;
  }

  const groups =
    user?.role === 'client'
      ? CLIENT_NAV_GROUPS
      : user?.role === 'recycle_client'
        ? RECYCLE_CLIENT_NAV_GROUPS
        : NAV_GROUPS;
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter(isVisible),
    }))
    .filter((group) => group.links.length > 0);

  function handleLogout() {
    onClose();
    dispatch(logout());
  }

  const isDark = theme === 'dark';

  const sidebarBgColor = customTheme?.applyToSidebar
    ? (customTheme.accentColor || '#10b981')
    : isDark
      ? '#000000'
      : '#ffffff';

  return (
    <>
      <aside
        className={`sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col md:flex transition-all shadow-md ${
          customTheme?.applyToSidebar ? '' : 'dark:border-r dark:border-white/10'
        }`}
        style={{ backgroundColor: sidebarBgColor }}
      >
        <SidebarNav
          visibleGroups={visibleGroups}
          user={user}
          onLogout={handleLogout}
          customTheme={customTheme}
        />
      </aside>

      {createPortal(
        <div
          className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
            mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
          <aside
            className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col shadow-2xl transition-transform duration-300"
            style={{
              backgroundColor: sidebarBgColor,
              transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className={`absolute right-3 top-3 z-10 rounded-xl p-1.5 ${
                customTheme?.applyToSidebar
                  ? 'text-white/80 hover:bg-white/20 hover:text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <SidebarNav
              visibleGroups={visibleGroups}
              user={user}
              onLinkClick={onClose}
              onLogout={handleLogout}
              customTheme={customTheme}
            />
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}

export default Sidebar;
