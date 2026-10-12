import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import { StatusBadge, clientBatteryStatus } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { hasClientPermission } from '../../utils/permissions';
import resolveImageUrl from '../../utils/imageUrl';
import extractBatteryCode from '../../utils/extract-battery-code';
import DuePaymentModal from '../../components/client/dashboard/DuePaymentModal';
import RatingModal from '../../components/client/dashboard/RatingModal';
import CertificateModal from '../../components/client/dashboard/CertificateModal';
import ScanSearchModal from '../../components/client/dashboard/ScanSearchModal';
import { fmtDate, getDueDaysStatus, isOverdue, openInvoiceFile } from '../../components/client/dashboard/invoice-file';

// Client dashboard — mobile version of the web ClientDashboardPage, section by
// section: due-payment banner + popup, header with the quick actions, shipment
// tracker, the eight KPI cards, availability / success-rate / ESG figures, the
// three-step repair journey, sustainability milestones (with the new-
// certificate popup), quick search + the battery list with its five tabs and
// Rate button, latest invoices (View / PDF) and recent support tickets.
// Data: GET /clients/me/dashboard, /clients/me/batteries, /tickets?limit=4,
// /clients/me/invoices, /certificates/my-milestones.

// The web hides the due-payment popup for the rest of the browser session
// after "Remind Me Later"; here it stays hidden until the app restarts.
let duePopupDismissed = false;

const WORKSHOP_STATUSES = ['in_repair', 'in_progress', 'in_testing', 'testing', 'repair_testing', 'repaired'];
const END_OF_LIFE = ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed', 'recycled'];
const isVerified = (b) => b.intake_status === 'verified' || Boolean(b.verified_at);
const PAGE = 8;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function logoSrc(path) {
  if (!path) return null;
  if (/^(https?:|data:|file:)/.test(path) || path.startsWith('/')) return resolveImageUrl(path);
  return resolveImageUrl(`/uploads/client-logos/${path}`);
}

function Card({ label, tag, value, sub, cta, tone, onPress }) {
  const tones = {
    slate: ['border-slate-200 bg-white', 'text-slate-900', 'text-slate-600', 'bg-slate-100 text-slate-600'],
    amber: ['border-amber-200 bg-amber-50/70', 'text-amber-800', 'text-amber-700', 'bg-amber-100 text-amber-800'],
    blue: ['border-blue-200 bg-blue-50/70', 'text-blue-800', 'text-blue-700', 'bg-blue-100 text-blue-800'],
    teal: ['border-teal-200 bg-teal-50/70', 'text-teal-800', 'text-teal-700', 'bg-teal-100 text-teal-800'],
    emerald: ['border-emerald-200 bg-emerald-50/70', 'text-emerald-800', 'text-emerald-700', 'bg-emerald-100 text-emerald-800'],
    rose: ['border-rose-200 bg-rose-50/70', 'text-rose-800', 'text-rose-700', 'bg-rose-100 text-rose-800'],
    violet: ['border-violet-200 bg-violet-50/70', 'text-violet-800', 'text-violet-700', 'bg-violet-100 text-violet-800'],
    sky: ['border-sky-200 bg-sky-50/70', 'text-sky-800', 'text-sky-700', 'bg-sky-100 text-sky-800'],
  };
  const [box, strong, soft, chip] = tones[tone] || tones.slate;
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} activeOpacity={0.8} className={`w-[48%] rounded-2xl border p-3.5 ${box}`}>
      <Text className={`text-[10px] font-black uppercase tracking-wider ${soft}`} numberOfLines={1}>{label}</Text>
      {tag ? <Text className={`mt-1 self-start rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${chip}`}>{tag}</Text> : null}
      <Text className={`mt-1 text-2xl font-black ${strong}`}>{Number(value || 0).toLocaleString()}</Text>
      <Text className={`mt-0.5 text-[10px] ${soft}`} numberOfLines={2}>{sub}</Text>
      {cta && onPress ? <Text className={`mt-1 text-[10px] font-bold ${strong}`}>{cta} →</Text> : null}
    </TouchableOpacity>
  );
}

function SectionTitle({ title, sub, action, onAction }) {
  return (
    <View className="flex-row items-end justify-between gap-2">
      <View className="flex-1">
        <Text className="text-sm font-black text-slate-900 dark:text-white">{title}</Text>
        {sub ? <Text className="mt-0.5 text-[11px] text-slate-500">{sub}</Text> : null}
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={6} className="shrink">
          <Text className="text-right text-xs font-bold text-emerald-700">{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function QuickAction({ icon, color, label, onPress, primary }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 ${primary ? 'w-full bg-emerald-600' : 'w-[48%] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}
    >
      <Icon name={icon} color={primary ? '#ffffff' : color} size={16} />
      <Text className={`text-xs font-bold ${primary ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function Meter({ label, value, sub, color, bar }) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</Text>
        <Text className={`text-lg font-black ${color}`}>{value}%</Text>
      </View>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <View className={`h-2 rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(0, Number(value)))}%` }} />
      </View>
      <Text className="mt-1.5 text-[10px] text-slate-500">{sub}</Text>
    </View>
  );
}

export default function ClientDashboardScreen() {
  const navigation = useNavigation();
  const user = useSelector((s) => s.auth.user);
  const [data, setData] = useState(null);
  const [allBatteries, setAllBatteries] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [milestoneData, setMilestoneData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [showDueModal, setShowDueModal] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(null);
  const [tableTab, setTableTab] = useState('all');
  const [inlineSearch, setInlineSearch] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [showScan, setShowScan] = useState(false);
  const [rateCode, setRateCode] = useState(null);
  const [milestoneCert, setMilestoneCert] = useState(null);
  const [previewCert, setPreviewCert] = useState(null);
  const milestoneShownRef = useRef(new Set());
  const dueAutoShownRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [dash, batt, tick, inv, certs] = await Promise.all([
        apiClient.get('/clients/me/dashboard'),
        apiClient.get('/clients/me/batteries'),
        apiClient.get('/tickets', { params: { limit: 4 } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/clients/me/invoices').catch(() => ({ data: { data: [] } })),
        apiClient.get('/certificates/my-milestones').catch(() => ({ data: null })),
      ]);
      setData(dash.data);
      setAllBatteries(batt.data?.data || []);
      setRecentTickets(tick.data?.data || []);
      const invList = inv.data?.data || [];
      setInvoices(invList);
      // Opens by itself once per visit to the dashboard (the web opens it on
      // every page load) until "Remind Me Later" is pressed.
      if (!duePopupDismissed && !dueAutoShownRef.current && invList.some((i) => i.status !== 'paid')) {
        dueAutoShownRef.current = true;
        setShowDueModal(true);
      }
      if (certs?.data) {
        setMilestoneData(certs.data);
        const next = (certs.data.unacknowledged || []).find((c) => !milestoneShownRef.current.has(c.id));
        if (next) {
          milestoneShownRef.current.add(next.id);
          setMilestoneCert(next);
        }
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the dashboard comes back into view (e.g. after recording
  // a truck intake), like the web refreshes after its intake popup.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const { client, stats } = data || {};
  const n = (k) => Number(stats?.[k] || 0);
  const totalBatteries = n('battery_count');
  const repaired = n('repaired_count');
  const returned = n('returned_count'); // came back from the workshop
  const registered = n('registered_count'); // with the client, never serviced
  const inFleet = returned + registered;
  const unserviceable = n('unserviceable_count');
  const repairVisits = n('repair_visit_count');
  const balanceOwed = n('balance');

  // Same figures as the web: the server's count when it sends one, otherwise
  // worked out from the battery list.
  const counted = (key, fn) => (stats?.[key] !== undefined ? Number(stats[key]) : allBatteries.filter(fn).length);
  const returnedFromWorkshop = counted('returned_from_workshop_count', (b) => (b.status === 'returned' && b.truck_intake_id) || Boolean(b.return_id));
  const totalPacked = counted('total_packed_count', (b) => Boolean(b.truck_intake_id));
  const verifiedIntake = counted('verified_intake_count', (b) => b.truck_intake_id && isVerified(b));
  const awaitingIntake = counted('awaiting_intake_count', (b) => b.truck_intake_id && (b.intake_status === 'pending_arrival' || (!b.verified_at && b.intake_status !== 'verified')));
  const workshopQueue = counted('workshop_queue_count', (b) => b.status === 'in_repair' && isVerified(b));
  const inWorkshop = counted('in_workshop_count', (b) => isVerified(b) && WORKSHOP_STATUSES.includes(b.status));

  const tabCounts = useMemo(() => ({
    all: allBatteries.length,
    workshop: inWorkshop,
    fleet: allBatteries.filter((b) => b.status === 'returned' || b.status === 'registered').length,
    packed: awaitingIntake,
    unserviceable: allBatteries.filter((b) => END_OF_LIFE.includes(b.status)).length,
  }), [allBatteries, inWorkshop, awaitingIntake]);

  const filteredBatteries = useMemo(() => {
    let list = allBatteries;
    if (tableTab === 'workshop') list = list.filter((b) => isVerified(b) && WORKSHOP_STATUSES.includes(b.status));
    else if (tableTab === 'fleet') list = list.filter((b) => b.status === 'returned' || b.status === 'registered');
    else if (tableTab === 'packed') list = list.filter((b) => b.status !== 'returned' && b.status !== 'registered' && (b.intake_status === 'pending_arrival' || (!b.verified_at && b.intake_status !== 'verified')));
    else if (tableTab === 'unserviceable') list = list.filter((b) => END_OF_LIFE.includes(b.status));
    const q = inlineSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((b) =>
        b.battery_code?.toLowerCase().includes(q)
        || b.serial_number?.toLowerCase().includes(q)
        || String(b.truck_number || '').toLowerCase().includes(q));
    }
    return list;
  }, [allBatteries, tableTab, inlineSearch]);

  const fleetAvailabilityRate = totalBatteries > 0 ? ((inFleet / totalBatteries) * 100).toFixed(1) : '100.0';
  const restorationSuccessRate = returned + unserviceable > 0 ? ((returned / (returned + unserviceable)) * 100).toFixed(1) : '100.0';
  const estimatedCo2Saved = (returned * 3.8).toFixed(0);

  const servicedCount = Number(milestoneData?.servicedCount || 0);
  const allMilestoneCerts = milestoneData?.allCerts || [];
  const nextTier = (milestoneData?.milestoneTiers || []).find((t) => t.count > servicedCount);
  const nextTierProgress = nextTier ? Math.min(100, Math.round((servicedCount / nextTier.count) * 100)) : 100;

  const unpaidInvoices = invoices.filter((inv) => inv.status !== 'paid');
  const overdueInvoices = unpaidInvoices.filter(isOverdue);
  const hasOverdue = overdueInvoices.length > 0;

  const can = (k) => hasClientPermission(user, k);
  const goBatteries = (bucket, status) => navigation.navigate('MyBatteries', { initialBucket: bucket, initialStatus: status });
  const openBattery = (code) => navigation.navigate('BatteryDetail', { code, fromScan: false });

  function dismissDue() {
    duePopupDismissed = true;
    setShowDueModal(false);
  }

  async function closeMilestone() {
    const cert = milestoneCert;
    setMilestoneCert(null);
    if (!cert?.id) return;
    try {
      await apiClient.post(`/certificates/acknowledge/${cert.id}`);
      const { data: res } = await apiClient.get('/certificates/my-milestones');
      if (res) setMilestoneData(res);
    } catch {
      // the certificate stays "new" and is offered again next time
    }
  }

  async function invoiceFile(inv, download) {
    setInvoiceBusy(inv.id);
    try {
      await openInvoiceFile(inv, { download });
    } catch (err) {
      Alert.alert(download ? 'Download failed' : 'Could not open invoice', err.message || 'Please try again.');
    } finally {
      setInvoiceBusy(null);
    }
  }

  function submitInlineSearch() {
    const code = extractBatteryCode(inlineSearch);
    if (code) openBattery(code);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" size="large" />
        <Text className="mt-3 text-sm font-medium text-slate-500">Loading your client portal…</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <View className="w-full items-center rounded-3xl border border-red-200 bg-red-50 p-8">
          <Text className="text-center text-base font-semibold text-red-700">{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }} className="mt-4 rounded-xl bg-red-600 px-5 py-2.5">
            <Text className="text-sm font-semibold text-white">Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const logo = logoSrc(client?.logo_path);
  const TABS = [
    { id: 'all', label: 'All Batteries', on: 'bg-slate-900' },
    { id: 'workshop', label: 'In Workshop', on: 'bg-blue-600' },
    { id: 'fleet', label: 'Active in Fleet', on: 'bg-emerald-600' },
    { id: 'packed', label: 'In Transit', on: 'bg-amber-600' },
    { id: 'unserviceable', label: 'Scrapped / Recycled', on: 'bg-rose-600' },
  ];

  return (
    <>
      <ScrollView
        className="flex-1 bg-slate-50 dark:bg-slate-950"
        contentContainerClassName="p-4 pb-16 gap-4"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {error ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
            <Text className="text-xs font-semibold text-red-700">{error}</Text>
          </View>
        ) : null}

        {/* Pending / overdue payment banner */}
        {unpaidInvoices.length > 0 && (
          <View className={`rounded-3xl border p-4 ${hasOverdue ? 'border-rose-300 bg-rose-50' : 'border-amber-300 bg-amber-50'}`}>
            <View className="flex-row items-start gap-3">
              <View className={`rounded-2xl p-2.5 ${hasOverdue ? 'bg-rose-100' : 'bg-amber-100'}`}>
                <Icon name="alertTriangle" color={hasOverdue ? '#be123c' : '#92400e'} size={18} />
              </View>
              <View className="flex-1">
                <Text className={`text-sm font-black ${hasOverdue ? 'text-rose-900' : 'text-amber-950'}`}>
                  {hasOverdue ? 'Action Required: Overdue Payment Notice' : 'Pending Due Payment Reminder'}
                </Text>
                <Text className={`mt-1 self-start rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${hasOverdue ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-900'}`}>
                  {hasOverdue ? `${overdueInvoices.length} Overdue` : `${unpaidInvoices.length} Pending`}
                </Text>
                <Text className={`mt-1 text-xs ${hasOverdue ? 'text-rose-700' : 'text-amber-800'}`}>
                  You have <Text className="font-bold">{unpaidInvoices.length} unpaid billing statement{unpaidInvoices.length > 1 ? 's' : ''}</Text> awaiting settlement.
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity onPress={() => setShowDueModal(true)} className={`flex-1 items-center rounded-xl py-2.5 ${hasOverdue ? 'bg-rose-600' : 'bg-amber-600'}`}>
                <Text className="text-xs font-black text-white">View Due Invoices →</Text>
              </TouchableOpacity>
              {can('client_invoices') && (
                <TouchableOpacity onPress={() => navigation.navigate('Invoices')} className="items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                  <Text className="text-xs font-bold text-slate-700">Invoices Page</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Header + quick actions */}
        <View className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <View className="flex-row items-center gap-3">
            {logo ? (
              <Image source={{ uri: logo }} resizeMode="contain" className="h-12 w-12 rounded-2xl border border-slate-200 bg-white" />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600">
                <Text className="text-lg font-black text-white">{(client?.name || 'C').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Verified Fleet Portal</Text>
                </View>
                <Text className="text-[11px] font-medium text-slate-400">{greeting()}</Text>
              </View>
              <Text className="mt-1 text-xl font-black text-slate-900 dark:text-white" numberOfLines={1}>{client?.name || user?.name || 'Client Fleet Hub'}</Text>
            </View>
          </View>
          <Text className="mt-2 text-xs text-slate-500">
            Real-time battery lifecycle tracking, workshop diagnostics, return deliveries & certified ESG impact.
          </Text>

          {can('client_transactions') && (
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')} className="mt-3 flex-row items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Balance owed</Text>
                <Text className="text-lg font-black text-amber-800">£{balanceOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <Text className="text-xs font-bold text-amber-800">Transactions ›</Text>
            </TouchableOpacity>
          )}

          <View className="mt-3 flex-row flex-wrap justify-between gap-y-2">
            {can('client_packed') && <QuickAction primary icon="truck" label="+ Add Truck Intake" onPress={() => navigation.navigate('ClientTruckIntake')} />}
            <QuickAction icon="search" color="#059669" label="Scan QR / Search" onPress={() => setShowScan(true)} />
            {can('client_battery_sorting') && <QuickAction icon="grid" color="#2563eb" label="Sort Batteries" onPress={() => navigation.navigate('BatterySorting')} />}
            {can('client_invoices') && <QuickAction icon="card" color="#d97706" label="Invoices" onPress={() => navigation.navigate('Invoices')} />}
            {can('client_support') && <QuickAction icon="user" color="#9333ea" label="Help Desk" onPress={() => navigation.navigate('Support')} />}
          </View>
        </View>

        {/* Shipment & workshop receiving tracker */}
        {totalPacked > 0 && (
          <View className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-amber-100"><Icon name="truck" color="#92400e" size={18} /></View>
              <View className="flex-1">
                <Text className="text-[11px] font-black uppercase tracking-wider text-amber-900">Shipment & Workshop Receiving Tracker</Text>
                <Text className="mt-1 self-start rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-black text-amber-900">{totalPacked} Total Units Packed</Text>
                <Text className="mt-1.5 text-xs text-slate-600">
                  <Text className="font-bold text-blue-700">{verifiedIntake} verified at workshop</Text> • <Text className="font-bold text-amber-700">{awaitingIntake} in transit / awaiting check-in</Text>
                </Text>
              </View>
            </View>
            {can('client_packed') && (
              <TouchableOpacity onPress={() => goBatteries('packed')} className="mt-3 items-center rounded-2xl border border-slate-200 bg-white py-2.5">
                <Text className="text-xs font-bold text-slate-800">Inspect Packed Trucks →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Eight KPI cards — same as the web */}
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <Card label="Total Batteries" tag="All Units" value={totalBatteries} sub="All registered fleet" cta="View All" tone="slate" onPress={can('client_all_batteries') ? () => goBatteries('all') : null} />
          <Card label="On The Way" tag="In Transit" value={awaitingIntake} sub="Traveling to workshop" cta="Inspect" tone="amber" onPress={can('client_packed') ? () => goBatteries('packed') : null} />
          <Card label="In Workshop" tag="Being Fixed" value={workshopQueue} sub="Under diagnosis & repair" cta="Live Queue" tone="blue" onPress={can('client_packed') ? () => goBatteries('packed') : null} />
          <Card label="Ready to Return" tag="Fixed" value={repaired} sub="Repaired & tested" cta="View Ready" tone="teal" onPress={can('client_all_batteries') ? () => goBatteries('all', 'repaired') : null} />
          <Card label="Working in Fleet" tag="With You" value={inFleet} sub={`Active in your vehicles${registered > 0 ? ` · ${registered.toLocaleString()} not serviced yet` : ''}`} cta="View Fleet" tone="emerald" onPress={can('client_all_batteries') ? () => goBatteries('all', 'in_fleet') : null} />
          <Card label="Scrapped / Recycled" tag="End of Life" value={unserviceable} sub="Unrepairable units" cta="History" tone="rose" onPress={can('client_all_batteries') ? () => goBatteries('all', 'unserviceable') : null} />
          <Card label="Total Repairs Done" tag="Lifetime" value={repairVisits} sub="All-time completed jobs" cta="Timeline" tone="violet" onPress={() => navigation.navigate('ClientHistory')} />
          <Card label="Returned Batteries" tag="Received" value={returnedFromWorkshop} sub="Received back from workshop" cta="View Received" tone="sky" onPress={can('client_received') ? () => goBatteries('received') : null} />
        </View>

        {/* Operational metrics + ESG */}
        <Meter label="Fleet Operational Availability" value={fleetAvailabilityRate} sub={`${inFleet} / ${totalBatteries} in rotation`} color="text-emerald-700" bar="bg-emerald-500" />
        <Meter label="Refurbishment Success Rate" value={restorationSuccessRate} sub="High Yield QA" color="text-blue-700" bar="bg-blue-500" />
        <TouchableOpacity onPress={() => navigation.navigate('ClientCertificates')} className="rounded-2xl border border-emerald-300 bg-emerald-600 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-black uppercase tracking-wider text-emerald-100">ESG Impact & CO₂ Avoided</Text>
            <Text className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-black uppercase text-white">Eco Certified</Text>
          </View>
          <Text className="mt-1 text-2xl font-black text-white">~{estimatedCo2Saved} kg CO₂</Text>
          <Text className="mt-0.5 text-[11px] text-emerald-50">Circular economy battery reclamation diverting toxic metals from landfill.</Text>
          <Text className="mt-2 text-xs font-bold text-white">View ESG Milestone →</Text>
        </TouchableOpacity>

        {/* Repair lifecycle journey */}
        <SectionTitle
          title="Battery Repair Lifecycle Journey"
          sub="End-to-end transparent visibility of your batteries through intake, workshop restoration, and fleet delivery."
          action={`All Inventory (${totalBatteries}) →`}
          onAction={can('client_all_batteries') ? () => goBatteries('all') : null}
        />
        <View className="gap-2">
          {[
            { step: 'Step 1 · On The Way', units: awaitingIntake, title: 'In Transit & Workshop Intake', text: `Packaged at your facility or scheduled for workshop truck intake and initial receiving verification (${totalPacked} packed total).`, cta: 'Inspect Packed List', icon: 'package', color: '#b45309', box: 'border-amber-200', chip: 'bg-amber-100 text-amber-900', perm: 'client_packed', go: () => goBatteries('packed') },
            { step: 'Step 2 · In Workshop', units: inWorkshop, title: 'Workshop Diagnostics & Repair', text: `Undergoing component repair, cell diagnostic testing, and quality assurance at the workshop (${workshopQueue} in queue, ${repaired} ready).`, cta: 'View In-Service Queue', icon: 'wrench', color: '#1d4ed8', box: 'border-blue-200', chip: 'bg-blue-100 text-blue-900', perm: 'client_packed', go: () => goBatteries('pending') },
            { step: 'Step 3 · Back in Fleet', units: returned, title: 'Working in Fleet (Active Depot)', text: 'QA-approved batteries verified, return-dispatched, and operating reliably in your depot fleet.', cta: 'View Received Fleet', icon: 'checkCircle', color: '#047857', box: 'border-emerald-200', chip: 'bg-emerald-100 text-emerald-900', perm: 'client_received', go: () => goBatteries('received') },
          ].map((s) => {
            const allowed = can(s.perm);
            return (
              <TouchableOpacity key={s.step} disabled={!allowed} onPress={s.go} className={`rounded-2xl border bg-white p-4 dark:bg-slate-900 ${s.box}`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Icon name={s.icon} color={s.color} size={16} />
                    <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500">{s.step}</Text>
                  </View>
                  <Text className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${s.chip}`}>{s.units} Units</Text>
                </View>
                <Text className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{s.title}</Text>
                <Text className="mt-0.5 text-[11px] text-slate-500">{s.text}</Text>
                {allowed ? <Text className="mt-2 text-xs font-bold" style={{ color: s.color }}>{s.cta} →</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sustainability milestones */}
        <View className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <View className="flex-row items-start gap-2">
            <Icon name="award" color="#b45309" size={18} />
            <View className="flex-1">
              <Text className="text-sm font-black text-slate-900 dark:text-white">Sustainability Milestones & Green Fleet Badges</Text>
              <Text className="mt-1 self-start rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900">
                {allMilestoneCerts.length > 0 ? `${allMilestoneCerts.length} Earned` : 'In Progress'}
              </Text>
              <Text className="mt-1 text-[11px] text-slate-500">Official circular economy credentials recognizing your depot's carbon reduction and battery reuse.</Text>
            </View>
          </View>
          {nextTier ? (
            <View className="mt-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <View className="flex-row items-center gap-1.5">
                <Icon name="zap" color="#d97706" size={14} />
                <Text className="text-xs font-bold text-slate-800 dark:text-slate-200">Target: {nextTier.title}</Text>
              </View>
              <Text className="mt-1 text-[11px] text-slate-500">
                {servicedCount.toLocaleString()} / {Number(nextTier.count).toLocaleString()} Serviced Units ({nextTierProgress}%)
              </Text>
              <View className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <View className="h-2 rounded-full bg-amber-500" style={{ width: `${nextTierProgress}%` }} />
              </View>
            </View>
          ) : null}
          {allMilestoneCerts.length > 0 ? (
            <View className="mt-3 gap-2">
              {allMilestoneCerts.map((cert) => (
                <TouchableOpacity key={cert.id} onPress={() => setPreviewCert(cert)} className="flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                  <Icon name="award" color="#b45309" size={18} />
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-slate-900" numberOfLines={1}>{cert.title}</Text>
                    <Text className="text-[10px] text-emerald-700">{Number(cert.co2_saved_kg || 0).toLocaleString()} kg CO₂ Offset</Text>
                  </View>
                  <Icon name="eye" color="#64748b" size={16} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <TouchableOpacity onPress={() => navigation.navigate('ClientCertificates')} className="mt-3 items-center rounded-2xl border border-slate-200 py-2.5">
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">View All ESG Certificates →</Text>
          </TouchableOpacity>
        </View>

        {/* Quick search */}
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
            <Icon name="search" color="#94a3b8" size={16} />
            <TextInput
              value={inlineSearch}
              onChangeText={(v) => { setInlineSearch(v); setShown(PAGE); }}
              onSubmitEditing={submitInlineSearch}
              returnKeyType="search"
              autoCapitalize="characters"
              placeholder="Quick Search: Battery ID or serial number…"
              placeholderTextColor="#94a3b8"
              className="min-w-0 flex-1 py-3 text-sm text-slate-900 dark:text-white"
            />
          </View>
          <TouchableOpacity disabled={!inlineSearch.trim()} onPress={submitInlineSearch} className={`h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 ${inlineSearch.trim() ? '' : 'opacity-50'}`}>
            <Icon name="arrowRight" color="#fff" size={18} />
          </TouchableOpacity>
        </View>

        {/* Fleet battery list with the five tabs */}
        <SectionTitle
          title="Fleet Battery Activity & Records"
          sub="Live records of your registered battery units, physical serials, and current lifecycle stages."
          action={`View Full Inventory (${allBatteries.length}) →`}
          onAction={can('client_all_batteries') ? () => goBatteries('all') : null}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {TABS.map((t) => {
            const on = tableTab === t.id;
            return (
              <TouchableOpacity key={t.id} onPress={() => { setTableTab(t.id); setShown(PAGE); }} className={`flex-row items-center gap-1.5 rounded-xl px-3 py-1.5 ${on ? t.on : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                <Text className={`text-xs font-bold ${on ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{t.label}</Text>
                <Text className={`rounded-full px-1.5 text-[10px] font-black ${on ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'}`}>{tabCounts[t.id]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {filteredBatteries.length === 0 ? (
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <Text className="text-xs text-slate-400">No batteries matching the selected filter.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {filteredBatteries.slice(0, shown).map((item) => (
              <TouchableOpacity key={item.id} onPress={() => openBattery(item.battery_code)} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-blue-700">{item.battery_code}</Text>
                    <Text className="text-[11px] text-slate-500">{item.serial_number ? `SN ${item.serial_number}` : 'Unassigned'}</Text>
                  </View>
                  <StatusBadge status={clientBatteryStatus(item)} />
                </View>
                <View className="mt-2 flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-[11px] text-slate-500">
                    {item.truck_number ? `Truck #${item.truck_number}` : 'No truck'} · {fmtDate(item.created_at)}
                  </Text>
                  {item.status === 'returned' && (
                    <TouchableOpacity onPress={() => setRateCode(item.battery_code)} hitSlop={6} className="rounded-lg bg-amber-100 px-2.5 py-1">
                      <Text className="text-[11px] font-bold text-amber-800">★ Rate</Text>
                    </TouchableOpacity>
                  )}
                  <Text className="text-[11px] font-bold text-emerald-700">Details →</Text>
                </View>
              </TouchableOpacity>
            ))}
            {filteredBatteries.length > shown && (
              <TouchableOpacity onPress={() => setShown((s) => s + 20)} className="items-center rounded-2xl border border-dashed border-slate-300 py-2.5">
                <Text className="text-xs font-bold text-slate-600">Showing {shown} of {filteredBatteries.length} · Show more</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Invoices & statements */}
        {can('client_invoices') && (
          <View className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <SectionTitle title="Invoices & Statements" sub="Recent billing notices and PDF receipts" action={`All Invoices (${invoices.length}) →`} onAction={() => navigation.navigate('Invoices')} />
            {invoices.length === 0 ? (
              <View className="items-center py-6">
                <Text className="text-xs font-semibold text-slate-600">No invoices issued yet</Text>
                <Text className="mt-0.5 text-[11px] text-slate-400">Service statements will appear here upon completion.</Text>
              </View>
            ) : (
              <View className="mt-3 gap-2">
                {invoices.slice(0, 3).map((inv) => {
                  const due = getDueDaysStatus(inv.due_date);
                  const paid = inv.status === 'paid';
                  const busy = invoiceBusy === inv.id;
                  return (
                    <View key={inv.id} className="flex-row items-center gap-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5">
                          <Text className="text-sm font-bold text-slate-900 dark:text-white" numberOfLines={1}>{inv.invoice_number}</Text>
                          <Text className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${paid ? 'bg-emerald-100 text-emerald-800' : due.isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                            {paid ? 'Paid' : due.isOverdue ? 'Overdue' : 'Pending'}
                          </Text>
                        </View>
                        <Text className="text-[11px] text-slate-500">Issued {fmtDate(inv.issue_date)}</Text>
                      </View>
                      {inv.file_path ? (
                        <>
                          <TouchableOpacity disabled={busy} onPress={() => invoiceFile(inv, false)} className="rounded-lg border border-slate-200 px-2.5 py-1.5">
                            {busy ? <ActivityIndicator size="small" /> : <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-200">View</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity disabled={busy} onPress={() => invoiceFile(inv, true)} className="rounded-lg bg-slate-900 px-2.5 py-1.5">
                            <Text className="text-[11px] font-bold text-white">↓ PDF</Text>
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
            <View className="mt-3 flex-row flex-wrap justify-between gap-x-4 gap-y-2">
              {can('client_transactions') ? (
                <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                  <Text className="text-[11px] font-bold text-emerald-700">View Detailed Billing History →</Text>
                </TouchableOpacity>
              ) : <View />}
              <TouchableOpacity onPress={() => navigation.navigate('Invoices')}>
                <Text className="text-[11px] font-bold text-emerald-700">Download PDF Statements →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Help & support desk */}
        {can('client_support') && (
          <View className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <SectionTitle title="Help & Support Desk" sub="Direct message line to Refurbnics operations" action="Inbox →" onAction={() => navigation.navigate('Support')} />
            {recentTickets.length === 0 ? (
              <View className="items-center py-6">
                <Text className="text-xs font-semibold text-slate-600">All caught up</Text>
                <Text className="mt-0.5 text-center text-[11px] text-slate-400">No active support inquiries. Need assistance with a delivery or battery?</Text>
              </View>
            ) : (
              <View className="mt-3 gap-2">
                {recentTickets.map((t) => (
                  <TouchableOpacity key={t.id} onPress={() => navigation.navigate('Support', { ticketId: t.id })} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="text-[11px] font-bold text-slate-500">{t.ticket_number || `#${t.id}`}</Text>
                      <Text className={`text-[10px] font-bold uppercase ${t.status === 'resolved' || t.status === 'closed' ? 'text-emerald-600' : 'text-amber-600'}`}>{String(t.status || '').replace(/_/g, ' ')}</Text>
                    </View>
                    <Text className="mt-1 text-sm font-semibold text-slate-900 dark:text-white" numberOfLines={1}>{t.subject}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Support')} className="mt-3 flex-row items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3">
              <Text className="text-sm font-bold text-white">+ Create New Support Ticket</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <DuePaymentModal
        visible={showDueModal && !milestoneCert}
        invoices={invoices}
        onDismiss={dismissDue}
        onOpenInvoices={() => {
          setShowDueModal(false);
          if (can('client_invoices')) navigation.navigate('Invoices');
        }}
      />
      <ScanSearchModal
        visible={showScan}
        onClose={() => setShowScan(false)}
        onOpenCamera={() => { setShowScan(false); navigation.navigate('ScanQR'); }}
        onOpenBattery={(code) => { setShowScan(false); openBattery(code); }}
      />
      <RatingModal batteryCode={rateCode} clientId={client?.id} onClose={() => setRateCode(null)} />
      {milestoneCert ? <CertificateModal mode="milestone" certificate={milestoneCert} clientName={client?.name} onClose={closeMilestone} /> : null}
      {previewCert && !milestoneCert ? <CertificateModal certificate={previewCert} clientName={client?.name} onClose={() => setPreviewCert(null)} /> : null}
    </>
  );
}
