// Web admin paths (as the API's notification `actionUrl`s and the web
// dashboard links use them) → the matching mobile screen. One place to
// update when a dedicated mobile screen replaces a generic one.
export function navigateWebPath(navigation, path) {
  if (!path) return false;
  const [pathname, query = ''] = String(path).split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  const parts = pathname.split('/').filter(Boolean);
  const [root, id] = parts;
  const go = (name, p) => { navigation.navigate(name, p); return true; };

  switch (root) {
    case 'batteries':
      if (id === 'unserviceable') return go('UnserviceableBatteries');
      if (id === 'recycled') return go('RecycledBatteries');
      if (id) return go('BatteryDetail', { code: decodeURIComponent(id), fromScan: false });
      return go('Batteries', { status: params.status || '', search: '' });
    case 'messages':
      return go('Support', params.ticket ? { ticketId: Number(params.ticket) } : undefined);
    case 'parts':
      if (id) return go('AdminDetail', { kind: 'part', id: Number(id) });
      return go('Parts', params.lowStock ? { lowStock: true } : undefined);
    case 'returns':
      if (id) return go('AdminDetail', { kind: 'return', id: Number(id) });
      return go('Returns');
    case 'truck-intakes':
      if (id) return go('AdminDetail', { kind: 'intake', id: Number(id) });
      return go('Intakes');
    case 'staff':
      if (id) return go('AdminDetail', { kind: 'staff', id: Number(id) });
      return go('Directory', { tab: 'staff' });
    case 'ratings':
      if (id) return go('AdminRatingDetail', { id: Number(id) });
      return go('Ratings');
    case 'certificates':
      if (parts[1] === 'client' || parts[1] === 'clients') return go('AdminCertificateClient', { id: Number(parts[2]) });
      return go('Certificates');
    case 'recycle':
      if (id) return go('AdminDetail', { kind: 'recycle', id: Number(id) });
      return go('RecycleShipmentsAdmin');
    case 'notifications':
      return go('AdminNotifications');
    default:
      return false;
  }
}
