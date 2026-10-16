import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import { hasClientPermission } from '../../utils/permissions';
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


function Card({ label, tag, value, sub, cta, tone, onPress, icon }) {
  const tones = {
    slate: {
      box: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
      iconBg: 'bg-slate-100 dark:bg-slate-800',
      iconColor: '#475569',
      valueColor: 'text-slate-900 dark:text-white',
    },
    amber: {
      box: 'border-amber-200/90 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20',
      iconBg: 'bg-amber-100 dark:bg-amber-900/50',
      iconColor: '#d97706',
      valueColor: 'text-amber-900 dark:text-amber-200',
    },
    blue: {
      box: 'border-blue-200/90 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20',
      iconBg: 'bg-blue-100 dark:bg-blue-900/50',
      iconColor: '#2563eb',
      valueColor: 'text-blue-900 dark:text-blue-200',
    },
    teal: {
      box: 'border-teal-200/90 bg-teal-50/50 dark:border-teal-900/40 dark:bg-teal-950/20',
      iconBg: 'bg-teal-100 dark:bg-teal-900/50',
      iconColor: '#0d9488',
      valueColor: 'text-teal-900 dark:text-teal-200',
    },
    emerald: {
      box: 'border-emerald-200/90 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
      iconColor: '#059669',
      valueColor: 'text-emerald-900 dark:text-emerald-200',
    },
    rose: {
      box: 'border-rose-200/90 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20',
      iconBg: 'bg-rose-100 dark:bg-rose-900/50',
      iconColor: '#e11d48',
      valueColor: 'text-rose-900 dark:text-rose-200',
    },
  };
  const t = tones[tone] || tones.slate;
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.7}
      className={`w-[48.2%] justify-between rounded-2xl border p-3.5 shadow-2xs ${t.box}`}
    >
      <View className="flex-row items-center justify-between">
        <View className={`h-8 w-8 items-center justify-center rounded-xl ${t.iconBg}`}>
          <Icon name={icon} color={t.iconColor} size={16} />
        </View>
        {onPress && (
          <Text className="text-[10px] font-bold text-slate-400">View ›</Text>
        )}
      </View>
      <View className="mt-2.5">
        <Text className={`text-xl font-black tracking-tight ${t.valueColor}`}>
          {Number(value || 0).toLocaleString()}
        </Text>
        <Text className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-200" numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text className="mt-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function SectionTitle({ title, sub, action, onAction }) {
  return (
    <View className="flex-row items-end justify-between gap-2">
      <View className="flex-1">
        <Text className="text-xs font-black text-slate-900 dark:text-white">{title}</Text>
        {sub ? <Text className="mt-0.5 text-[10px] leading-3.5 text-slate-500 dark:text-slate-400">{sub}</Text> : null}
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={6} className="shrink pb-0.5">
          <Text className="text-right text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{action}</Text>
        </TouchableOpacity>
      ) : null}
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

  const [showScan, setShowScan] = useState(false);
  const [rateCode, setRateCode] = useState(null);
  const [milestoneCert, setMilestoneCert] = useState(null);
  const [previewCert, setPreviewCert] = useState(null);
  const milestoneShownRef = useRef(new Set());
  const dueAutoShownRef = useRef(false);
  const [lowParts, setLowParts] = useState([]);

  const load = useCallback(async () => {
    try {
      const [dash, batt, tick, inv, certs, parts] = await Promise.all([
        apiClient.get('/clients/me/dashboard'),
        apiClient.get('/clients/me/batteries'),
        apiClient.get('/tickets', { params: { limit: 4 } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/clients/me/invoices').catch(() => ({ data: { data: [] } })),
        apiClient.get('/certificates/my-milestones').catch(() => ({ data: null })),
        apiClient.get('/clients/me/parts').catch(() => ({ data: { data: [] } })),
      ]);
      setLowParts((parts.data?.data || []).filter((p) => p.is_low));
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

  const [inlineSearch, setInlineSearch] = useState('');

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


  return (
    <>
      <ScrollView
        className="flex-1 bg-slate-50 dark:bg-slate-950"
        contentContainerClassName="p-3.5 pb-20 gap-3.5"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {error ? (
          <View className="rounded-xl border border-red-200 bg-red-50 p-2.5">
            <Text className="text-xs font-semibold text-red-700">{error}</Text>
          </View>
        ) : null}

        {/* Pending / overdue payment banner */}
        {unpaidInvoices.length > 0 && (
          <View className={`rounded-2xl border p-3 ${hasOverdue ? 'border-rose-300 bg-rose-50' : 'border-amber-300 bg-amber-50'}`}>
            <View className="flex-row items-start gap-2.5">
              <View className={`rounded-xl p-2 ${hasOverdue ? 'bg-rose-100' : 'bg-amber-100'}`}>
                <Icon name="alertTriangle" color={hasOverdue ? '#be123c' : '#92400e'} size={16} />
              </View>
              <View className="flex-1">
                <Text className={`text-xs font-black ${hasOverdue ? 'text-rose-900' : 'text-amber-950'}`}>
                  {hasOverdue ? 'Action Required: Overdue Payment Notice' : 'Pending Due Payment Reminder'}
                </Text>
                <Text className={`mt-0.5 self-start rounded-full px-2 py-0.2 text-[9px] font-extrabold uppercase ${hasOverdue ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-900'}`}>
                  {hasOverdue ? `${overdueInvoices.length} Overdue` : `${unpaidInvoices.length} Pending`}
                </Text>
                <Text className={`mt-0.5 text-[11px] ${hasOverdue ? 'text-rose-700' : 'text-amber-800'}`}>
                  You have <Text className="font-bold">{unpaidInvoices.length} unpaid statement{unpaidInvoices.length > 1 ? 's' : ''}</Text> awaiting settlement.
                </Text>
              </View>
            </View>
            <View className="mt-2.5 flex-row gap-2">
              <TouchableOpacity onPress={() => setShowDueModal(true)} className={`flex-1 items-center rounded-xl py-2 ${hasOverdue ? 'bg-rose-600' : 'bg-amber-600'}`}>
                <Text className="text-[11px] font-black text-white">View Due Invoices →</Text>
              </TouchableOpacity>
              {can('client_invoices') && (
                <TouchableOpacity onPress={() => navigation.navigate('Invoices')} className="items-center rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Text className="text-[11px] font-bold text-slate-700">Invoices Page</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Header */}
        <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <Text className="text-base font-black text-slate-900 dark:text-white" numberOfLines={1}>{client?.name || user?.name || 'Client Fleet Hub'}</Text>
          <Text className="mt-1 text-[11px] text-slate-500 leading-4">
            Real-time battery lifecycle tracking, workshop diagnostics, return deliveries & certified ESG impact.
          </Text>

          {can('client_transactions') && (
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')} className="mt-2.5 flex-row items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <View>
                <Text className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Balance owed</Text>
                <Text className="text-base font-black text-amber-800">£{balanceOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <Text className="text-[11px] font-bold text-amber-800">Transactions ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Low parts stock (web: "Low Parts Stock" banner) */}
        {lowParts.length > 0 && (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-start gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-red-100"><Icon name="alertTriangle" color="#b91c1c" size={16} /></View>
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-black text-red-900">
                  Low Parts Stock — {lowParts.length} part{lowParts.length === 1 ? '' : 's'} at or below the minimum
                </Text>
                <Text className="mt-0.5 text-[11px] text-red-800">
                  {lowParts.slice(0, 3).map((p) => `${p.name} (${p.quantity} left, min ${p.min_stock})`).join(' · ')}
                  {lowParts.length > 3 ? ` · +${lowParts.length - 3} more` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ClientParts')} className="mt-2.5 self-start rounded-xl bg-red-600 px-3 py-1.5">
              <Text className="text-[11px] font-bold text-white">View Parts Inventory →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Shipment & workshop receiving tracker */}
        {totalPacked > 0 && (
          <View className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
            <View className="flex-row items-start gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-amber-100"><Icon name="truck" color="#92400e" size={16} /></View>
              <View className="flex-1">
                <Text className="text-[10px] font-black uppercase tracking-wider text-amber-900">Shipment & Receiving Tracker</Text>
                <Text className="mt-0.5 self-start rounded-full bg-amber-200 px-2 py-0.2 text-[9px] font-black text-amber-900">{totalPacked} Total Packed</Text>
                <Text className="mt-1 text-[11px] text-slate-600">
                  <Text className="font-bold text-blue-700">{verifiedIntake} verified</Text> • <Text className="font-bold text-amber-700">{awaitingIntake} in transit</Text>
                </Text>
              </View>
            </View>
            {can('client_packed') && (
              <TouchableOpacity onPress={() => goBatteries('packed')} className="mt-2.5 items-center rounded-xl border border-slate-200 bg-white py-2">
                <Text className="text-[11px] font-bold text-slate-800">Inspect Packed Trucks →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Core Fleet Status Cards (Simple, High-Contrast & Clear) */}
        <View className="flex-row flex-wrap justify-between gap-y-2.5">
          <Card
            label="Active in Fleet"
            icon="zap"
            value={inFleet}
            sub="Working in vehicles"
            tone="emerald"
            onPress={can('client_all_batteries') ? () => goBatteries('all', 'in_fleet') : null}
          />
          <Card
            label="In Workshop"
            icon="wrench"
            value={workshopQueue}
            sub="Under diagnosis & repair"
            tone="blue"
            onPress={can('client_packed') ? () => goBatteries('packed') : null}
          />
          <Card
            label="Ready to Return"
            icon="checkCircle"
            value={repaired}
            sub="Repaired & tested"
            tone="teal"
            onPress={can('client_all_batteries') ? () => goBatteries('all', 'repaired') : null}
          />
          <Card
            label="In Transit"
            icon="truck"
            value={awaitingIntake}
            sub="Traveling to workshop"
            tone="amber"
            onPress={can('client_packed') ? () => goBatteries('packed') : null}
          />
          <Card
            label="Total Batteries"
            icon="battery"
            value={totalBatteries}
            sub="All registered units"
            tone="slate"
            onPress={can('client_all_batteries') ? () => goBatteries('all') : null}
          />
          <Card
            label="Scrapped / Recycled"
            icon="rotateCcw"
            value={unserviceable}
            sub="End of life units"
            tone="rose"
            onPress={can('client_all_batteries') ? () => goBatteries('all', 'unserviceable') : null}
          />
        </View>

        {/* Operational Health & ESG Highlights */}
        <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-black uppercase tracking-wider text-slate-400">Fleet Health & Impact</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ClientCertificates')} hitSlop={6}>
              <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">ESG Certificates →</Text>
            </TouchableOpacity>
          </View>
          
          <View className="mt-2.5 flex-row items-center justify-between gap-2">
            <View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
              <Text className="text-[10px] font-bold text-slate-500">Availability</Text>
              <Text className="mt-0.5 text-base font-black text-emerald-700 dark:text-emerald-400">{fleetAvailabilityRate}%</Text>
              <View className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <View className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, Number(fleetAvailabilityRate)))}%` }} />
              </View>
            </View>

            <View className="flex-1 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
              <Text className="text-[10px] font-bold text-slate-500">Repair Yield</Text>
              <Text className="mt-0.5 text-base font-black text-blue-700 dark:text-blue-400">{restorationSuccessRate}%</Text>
              <View className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <View className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, Number(restorationSuccessRate)))}%` }} />
              </View>
            </View>

            <View className="flex-1 rounded-xl bg-emerald-50/70 p-2.5 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
              <Text className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">CO₂ Saved</Text>
              <Text className="mt-0.5 text-base font-black text-emerald-800 dark:text-emerald-200">~{estimatedCo2Saved} kg</Text>
              <Text className="mt-1 text-[9px] font-medium text-emerald-600 dark:text-emerald-400" numberOfLines={1}>Eco Certified</Text>
            </View>
          </View>
        </View>

        {/* Quick search */}
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-0.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <Icon name="search" color="#94a3b8" size={15} />
            <TextInput
              value={inlineSearch}
              onChangeText={setInlineSearch}
              onSubmitEditing={submitInlineSearch}
              returnKeyType="search"
              autoCapitalize="characters"
              placeholder="Quick Search: Battery ID or serial…"
              placeholderTextColor="#94a3b8"
              className="min-w-0 flex-1 py-2 text-xs font-medium text-slate-900 dark:text-white"
            />
            {inlineSearch.length > 0 ? (
              <TouchableOpacity onPress={() => setInlineSearch('')} hitSlop={6} className="p-1">
                <Icon name="close" color="#94a3b8" size={13} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            disabled={!inlineSearch.trim()}
            onPress={submitInlineSearch}
            className={`h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-2xs active:bg-emerald-700 ${inlineSearch.trim() ? '' : 'opacity-40'}`}
          >
            <Icon name="arrowRight" color="#fff" size={16} />
          </TouchableOpacity>
        </View>


        {/* Invoices & statements */}
        {can('client_invoices') && (
          <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <SectionTitle
              title="Invoices & Statements"
              sub="Recent billing notices and PDF receipts"
              action={`All (${invoices.length}) →`}
              onAction={() => navigation.navigate('Invoices')}
            />
            {invoices.length === 0 ? (
              <View className="items-center py-5">
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300">No invoices issued yet</Text>
                <Text className="mt-0.5 text-[10.5px] text-slate-400">Service statements will appear here upon completion.</Text>
              </View>
            ) : (
              <View className="mt-2.5 gap-1.5">
                {invoices.slice(0, 3).map((inv) => {
                  const due = getDueDaysStatus(inv.due_date);
                  const paid = inv.status === 'paid';
                  const busy = invoiceBusy === inv.id;
                  return (
                    <View key={inv.id} className="flex-row items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
                      <View className="h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                        <Icon name="card" color="#475569" size={14} />
                      </View>
                      <View className="min-w-0 flex-1">
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          <Text className="text-xs font-bold text-slate-900 dark:text-white" numberOfLines={1}>{inv.invoice_number}</Text>
                          <Text className={`rounded-full px-1.5 py-0.2 text-[8.5px] font-black uppercase ${paid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : due.isOverdue ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'}`}>
                            {paid ? 'Paid' : due.isOverdue ? 'Overdue' : 'Pending'}
                          </Text>
                        </View>
                        <Text className="text-[10px] text-slate-500 dark:text-slate-400">Issued {fmtDate(inv.issue_date)}</Text>
                      </View>
                      {inv.file_path ? (
                        <View className="flex-row items-center gap-1">
                          <TouchableOpacity disabled={busy} onPress={() => invoiceFile(inv, false)} className="rounded-lg border border-slate-200 px-2.5 py-1 active:bg-slate-50 dark:border-slate-700">
                            {busy ? <ActivityIndicator size="small" /> : <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-200">View</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity disabled={busy} onPress={() => invoiceFile(inv, true)} className="rounded-lg bg-slate-900 px-2.5 py-1 active:bg-slate-800">
                            <Text className="text-[10px] font-bold text-white">↓ PDF</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
            <View className="mt-2.5 flex-row flex-wrap justify-between gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
              {can('client_transactions') ? (
                <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
                  <Text className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">Billing History →</Text>
                </TouchableOpacity>
              ) : <View />}
              <TouchableOpacity onPress={() => navigation.navigate('Invoices')}>
                <Text className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">PDF Statements →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Help & support desk */}
        {can('client_support') && (
          <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <SectionTitle
              title="Help & Support Desk"
              sub="Direct message line to Refurbnics operations"
              action="Inbox →"
              onAction={() => navigation.navigate('Support')}
            />
            {recentTickets.length === 0 ? (
              <View className="items-center py-5">
                <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300">All caught up</Text>
                <Text className="mt-0.5 text-center text-[10.5px] text-slate-400">No active support inquiries. Need assistance with a delivery or battery?</Text>
              </View>
            ) : (
              <View className="mt-2.5 gap-1.5">
                {recentTickets.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => navigation.navigate('Support', { ticketId: t.id })}
                    activeOpacity={0.7}
                    className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-800"
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-1.5">
                        <Icon name="user" color="#64748b" size={12} />
                        <Text className="text-[10px] font-bold text-slate-500">{t.ticket_number || `#${t.id}`}</Text>
                      </View>
                      <Text className={`text-[9px] font-extrabold uppercase ${t.status === 'resolved' || t.status === 'closed' ? 'text-emerald-600' : 'text-amber-600'}`}>{String(t.status || '').replace(/_/g, ' ')}</Text>
                    </View>
                    <Text className="mt-1 text-xs font-semibold text-slate-900 dark:text-white" numberOfLines={1}>{t.subject}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              onPress={() => navigation.navigate('Support')}
              activeOpacity={0.8}
              className="mt-2.5 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 shadow-2xs active:bg-emerald-700"
            >
              <Text className="text-xs font-bold text-white">+ Create New Support Ticket</Text>
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
