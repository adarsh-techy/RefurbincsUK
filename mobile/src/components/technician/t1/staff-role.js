import { useEffect, useState } from 'react';
import apiClient from '../../../services/api-client';

// Mirror of frontend/src/utils/permissions.js canTestBatteries(): admins and
// supervisors may test; a plain technician may not.
export function canTestBatteries(user) {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  const role = (
    user.staff_role ||
    user.staffRole ||
    user.staff?.role ||
    user.staff?.staff_role ||
    user.role ||
    ''
  ).trim().toLowerCase();
  return role === 'supervisor';
}

// super_admin has every permission; anyone else only what's in user.permissions
export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return (user.permissions || []).includes(permission);
}

// The staff role saved at login can be stale (an admin promoted the
// technician to supervisor since), so the web re-reads it from /auth/me —
// same here. Returns the user with the live staff_role merged in.
export function useLiveStaffUser(user) {
  const [liveStaffRole, setLiveStaffRole] = useState(user?.staff_role || user?.staffRole || null);

  useEffect(() => {
    let cancelled = false;
    if (user && user.role !== 'client' && user.role !== 'recycle_client') {
      apiClient
        .get('/auth/me')
        .then((res) => {
          if (!cancelled && res.data?.user?.staff_role) setLiveStaffRole(res.data.user.staff_role);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { ...user, staff_role: liveStaffRole || user?.staff_role };
}
