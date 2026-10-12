import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import DateField, { prettyYmd, todayYmd } from '../../components/admin/DateField';
import formatDuration from '../../utils/format-duration';
import { navigateWebPath } from '../../components/admin/sa1/web-route';

// Office-role (super_admin / admin / staff) home — the mobile version of the
// web DashboardPage: GET /dashboard/summary?date=YYYY-MM-DD for the six KPI
// cards (with month-on-month change and 7-day trend), the selected day's
// repairs log and hourly velocity, the date picker, the quick command
// launcher, recent client return dispatches, and (super admin) average
// service time by part and by technician.

const QUICK_ACTIONS = [
  { to: '/truck-intakes', label: 'Intake Battery Shipment', desc: 'Receive & scan incoming batches', icon: 'truck', permission: 'truck_intakes', badge: 'Logistics' },
  { to: '/parts', label: 'Parts & Stock Inventory', desc: 'Manage quantities & restock', icon: 'package', permission: 'parts', badge: 'Inventory' },
  { to: '/returns', label: 'Dispatch Return Delivery', desc: 'Manifest verified serviced packs', icon: 'checkCircle', permission: 'returns', badge: 'Dispatch' },
  { to: '/certificates', label: 'Milestones & Impact Hub', desc: 'Track ESG decarbonization awards', icon: 'award', permission: null, badge: 'ESG' },
  { to: '/notifications', label: 'Operations Alerts Feed', desc: 'Live stock & support notices', icon: 'zap', permission: null, badge: 'Live' },
];

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

function hasPermission(user, key) {
  if (!key) return true;
  if (user?.role === 'super_admin') return true;
  return (user?.permissions || []).includes(key);
}

function buildHourlyRange(hourlyData) {
  const countsByHour = Object.fromEntries(hourlyData.map((d) => [d.hour, d.count]));
  const activeHours = hourlyData.map((d) => d.hour);
  const startHour = Math.min(DEFAULT_START_HOUR, ...activeHours);
  const endHour = Math.max(DEFAULT_END_HOUR, ...activeHours);
  const hours = [];
  for (let h = startHour; h <= endHour; h += 1) {
    const label = h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`;
    hours.push({ label, count: countsByHour[h] || 0 });
  }
  return hours;
}

function initials(name) {
  return (name || 'U').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

// 7-day trend as tiny bars (the web draws a sparkline)
function Sparkline({ values, color }) {
  const max = Math.max(1, ...values.map((v) => Number(v) || 0));
  return (
    <View className="mt-2 h-6 flex-row items-end gap-0.5 border-t border-slate-100 pt-1">
      {values.map((v, i) => (
        <View key={i} style={{ height: `${Math.max(6, ((Number(v) || 0) / max) * 100)}%`, backgroundColor: color, opacity: 0.75 }} className="flex-1 rounded-sm" />
      ))}
    </View>
  );
}

function Kpi({ label, value, sub, change, changeLabel, trend, color, box, onPress, alert }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} className={`w-[48%] rounded-2xl border p-3.5 ${box}`}>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-[10px] font-bold uppercase tracking-wide text-slate-500" numberOfLines={1}>{label}</Text>
        {alert ? <View className="h-2 w-2 rounded-full bg-rose-500" /> : null}
      </View>
      <Text className="mt-1 text-2xl font-black text-slate-900">{Number(value || 0).toLocaleString()}</Text>
      {typeof change === 'number' ? (
        <Text className="mt-0.5 text-[11px] font-bold text-emerald-600">
          ↗ {change > 0 ? `+${change}%` : `${change}%`} <Text className="font-normal text-slate-400">{changeLabel}</Text>
        </Text>
      ) : sub ? (
        <Text className="mt-0.5 text-[11px] font-medium text-slate-500" numberOfLines={1}>{sub}</Text>
      ) : null}
      {Array.isArray(trend) && trend.length > 0 ? <Sparkline values={trend} color={color} /> : null}
    </TouchableOpacity>
  );
}

function Section({ icon, iconColor, title, sub, right, children }) {
  return (
    <View className="rounded-3xl border border-slate-200 bg-white p-4">
      <View className="mb-3 flex-row items-center gap-2.5 border-b border-slate-100 pb-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-50">
          <Icon name={icon} color={iconColor} size={18} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-black text-slate-900">{title}</Text>
          {sub ? <Text className="text-[11px] text-slate-500">{sub}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function DurationList({ items, getLabel, onPress }) {
  const max = Math.max(1, ...items.map((i) => i.avgDurationSeconds || 0));
  return (
    <View className="gap-2">
      {items.map((item, i) => {
        const percent = Math.max(8, Math.min(100, ((item.avgDurationSeconds || 0) / max) * 100));
        return (
          <TouchableOpacity key={`${getLabel(item)}-${i}`} disabled={!onPress(item)} onPress={() => onPress(item)?.()} className="flex-row items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <View className="h-7 w-7 items-center justify-center rounded-lg bg-slate-200/70">
              <Text className="text-xs font-black text-slate-700">{i + 1}</Text>
            </View>
            <View className="flex-1">
              <View className="mb-1.5 flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-xs font-bold text-slate-800" numberOfLines={1}>{getLabel(item)}</Text>
                <Text className="font-mono text-xs font-bold text-blue-700">{formatDuration(item.avgDurationSeconds)}</Text>
              </View>
              <View className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                <View className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
              </View>
              <Text className="mt-1 text-[11px] text-slate-400">
                {item.repairCount} service cycle{item.repairCount === 1 ? '' : 's'} logged
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const user = useSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [date, setDate] = useState(todayYmd());
  const [pickDate, setPickDate] = useState(false);
  const isToday = date === todayYmd();

  const load = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/dashboard/summary', { params: { date } });
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const go = (path) => navigateWebPath(navigation, path);
  const totals = data?.totals || {};
  const changes = data?.changes || {};
  const trends = data?.trends || {};
  const todays = data?.todaysRepairs || [];
  const hourly = buildHourlyRange(data?.hourlyRepairsToday || []);
  const hasActivity = hourly.some((h) => h.count > 0);
  const maxHour = Math.max(1, ...hourly.map((h) => h.count));
  const returns = data?.recentClientReturns || [];
  const serviceTimes = data?.serviceTimes || {};
  const lowStock = Number(totals.lowStockParts || 0);

  if (error && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <View className="w-full items-center rounded-3xl border border-red-200 bg-red-50 p-6">
          <Text className="text-center text-sm font-bold text-red-600">{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }} className="mt-4 rounded-xl bg-red-600 px-5 py-2">
            <Text className="text-xs font-bold text-white">Retry Loading</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Header */}
      <View>
        <Text className="text-xl font-black text-slate-900">Welcome back{user?.name ? `, ${user.name}` : ''}!</Text>
        <Text className="mt-0.5 text-xs text-slate-500">
          Real-time battery refurbishment overview, workshop throughput analytics & return dispatches
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {!isToday && (
            <TouchableOpacity onPress={() => setDate(todayYmd())} className="flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2">
              <Icon name="calendar" color="#3b82f6" size={14} />
              <Text className="text-xs font-bold text-slate-700">Reset to Today</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => go('/notifications')} className="flex-row items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2">
            <Icon name="zap" color="#fff" size={14} />
            <Text className="text-xs font-black text-white">Operations Feed</Text>
            {lowStock > 0 && (
              <View className="min-w-[18px] items-center rounded-full bg-rose-500 px-1">
                <Text className="text-[10px] font-black text-white">{lowStock}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Scan')} className="flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2">
            <Icon name="camera" color="#0f172a" size={14} />
            <Text className="text-xs font-bold text-slate-700">Scan Battery</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      ) : null}

      {/* 6 KPI cards */}
      {loading && !data ? (
        <Text className="py-6 text-center text-xs font-bold text-slate-500">Loading Executive Dashboard…</Text>
      ) : (
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <Kpi label="Total Batteries" value={totals.totalBatteries} change={changes.totalBatteries} changeLabel="vs mo." trend={trends.totalBatteries} color="#2563eb" box="border-slate-200 bg-white" onPress={() => go('/batteries')} />
          <Kpi label="In Workshop" value={totals.pendingRepair} sub="Active service queue" trend={trends.pendingRepair} color="#d97706" box="border-amber-200 bg-amber-50/60" onPress={() => go('/batteries?status=in_repair')} />
          <Kpi label="Repaired & Ready" value={totals.repaired} change={changes.repaired} changeLabel="throughput" trend={trends.repaired} color="#059669" box="border-emerald-200 bg-emerald-50/60" onPress={() => go('/batteries?status=repaired')} />
          <Kpi label="Low Stock Parts" value={lowStock} sub={lowStock > 0 ? '⚠️ Replenishment needed' : '✓ Stock levels healthy'} alert={lowStock > 0} box={lowStock > 0 ? 'border-rose-300 bg-rose-50/60' : 'border-slate-200 bg-white'} onPress={() => go('/parts?lowStock=true')} />
          <Kpi label="Unserviceable" value={totals.unserviceable} sub="Awaiting scrap batch" box="border-slate-200 bg-white" onPress={() => go('/batteries/unserviceable')} />
          <Kpi label="Recycled & Saved" value={totals.recycled} sub="Diverted to recycling" box="border-slate-200 bg-white" onPress={() => go('/recycle')} />
        </View>
      )}

      {/* Date filter (the web's mini calendar) */}
      <View className="rounded-3xl border border-slate-200 bg-white p-4">
        <TouchableOpacity onPress={() => setPickDate((v) => !v)} className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <Icon name="calendar" color="#2563eb" size={16} />
            <Text className="text-xs font-bold text-slate-900">Filter Date Scoped Data</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="rounded-md bg-blue-50 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-blue-700">{prettyYmd(date)}</Text>
            </View>
            <Text className="text-[11px] font-bold text-blue-600">{pickDate ? 'Done' : 'Change'}</Text>
          </View>
        </TouchableOpacity>
        {pickDate && (
          <View className="mt-3">
            <DateField value={date} onChange={(v) => v && setDate(v)} clearable={false} />
          </View>
        )}
      </View>

      {/* Repairs log + hourly velocity */}
      <Section
        icon="wrench"
        iconColor="#2563eb"
        title={isToday ? "Today's Logged Repairs" : `Repairs Log — ${prettyYmd(date)}`}
        sub="Workshop technician diagnostic & repair execution stream"
        right={
          <View className="rounded-full bg-slate-100 px-2.5 py-1">
            <Text className="text-[11px] font-bold text-slate-700">{todays.length} logged unit{todays.length === 1 ? '' : 's'}</Text>
          </View>
        }
      >
        {todays.length === 0 ? (
          <View className="items-center py-8">
            <Icon name="clock" color="#94a3b8" size={22} />
            <Text className="mt-2 text-xs font-bold text-slate-700">{isToday ? 'No repairs logged yet today.' : `No repairs found on ${prettyYmd(date)}.`}</Text>
            <Text className="mt-1 text-center text-[11px] text-slate-400">Select a different date on the mini calendar to inspect previous activity logs.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {todays.map((r) => (
              <TouchableOpacity key={r.id} onPress={() => go(`/batteries/${encodeURIComponent(r.batteryCode)}`)} className="flex-row items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
                    <Text className="text-xs font-black text-white">{initials(r.staffName)}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text className="text-xs font-black text-slate-900" numberOfLines={1}>{r.staffName}</Text>
                      <Text className="rounded-md bg-blue-100 px-1.5 font-mono text-[10px] font-bold text-blue-800">{r.batteryCode}</Text>
                    </View>
                    <Text className="mt-0.5 text-[11px] text-slate-500" numberOfLines={1}>
                      Serviced: <Text className="font-semibold text-slate-700">{r.partName}</Text>
                    </Text>
                  </View>
                </View>
                <Text className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-600">
                  {r.repairedAt ? new Date(r.repairedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View className="mt-5 border-t border-slate-100 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isToday ? 'Hourly Workshop Velocity (Today)' : `Hourly Breakdown (${prettyYmd(date)})`}
            </Text>
          </View>
          {hasActivity ? (
            <View>
              <View className="h-28 flex-row items-end gap-1">
                {hourly.map((h) => (
                  <View key={h.label} className="flex-1 items-center justify-end">
                    {h.count > 0 ? <Text className="text-[9px] font-bold text-blue-700">{h.count}</Text> : null}
                    <View className={`w-full rounded-t ${h.count === maxHour ? 'bg-blue-700' : 'bg-blue-400'}`} style={{ height: `${Math.max(2, (h.count / maxHour) * 85)}%` }} />
                  </View>
                ))}
              </View>
              <View className="mt-1 flex-row gap-1">
                {hourly.map((h) => (
                  <Text key={h.label} className="flex-1 text-center text-[8px] text-slate-400">{h.label}</Text>
                ))}
              </View>
              <Text className="mt-1 text-right text-[10px] text-slate-400">Peak hours throughput analysis</Text>
            </View>
          ) : (
            <Text className="py-4 text-center text-xs text-slate-400">No hourly repairs distribution recorded for this date.</Text>
          )}
        </View>
      </Section>

      {/* Quick command launcher */}
      <Section icon="zap" iconColor="#f59e0b" title="Quick Command Launcher">
        <View className="gap-2">
          {QUICK_ACTIONS.filter((a) => hasPermission(user, a.permission)).map((a) => (
            <TouchableOpacity key={a.to} onPress={() => go(a.to)} className="flex-row items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5">
              <View className="flex-1 flex-row items-center gap-2.5">
                <View className="h-8 w-8 items-center justify-center rounded-xl bg-white">
                  <Icon name={a.icon} color="#334155" size={16} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>{a.label}</Text>
                  <Text className="text-[10px] text-slate-400" numberOfLines={1}>{a.desc}</Text>
                </View>
              </View>
              <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">{a.badge}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* Client returns stream */}
      <Section
        icon="truck"
        iconColor="#0d9488"
        title="Client Battery Returns & Receipt Dispatches"
        sub="Live dispatches of repaired packs returned to customer fleets"
      >
        {hasPermission(user, 'returns') && (
          <TouchableOpacity onPress={() => go('/returns')} className="mb-3 self-start rounded-xl bg-teal-50 px-3 py-1.5">
            <Text className="text-xs font-bold text-teal-700">Manage All Returns →</Text>
          </TouchableOpacity>
        )}
        {returns.length === 0 ? (
          <Text className="py-6 text-center text-xs text-slate-400">No recent client return dispatches recorded.</Text>
        ) : (
          <View className="gap-2.5">
            {returns.map((ret) => (
              <TouchableOpacity key={ret.id} onPress={() => go(`/returns/${ret.id}`)} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="self-start rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-700">✓ Dispatched</Text>
                    <Text className="mt-2 text-xs font-black text-slate-900" numberOfLines={1}>{ret.clientName}</Text>
                  </View>
                  <Text className="rounded-xl bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800">
                    {ret.batteryCount} {ret.batteryCount === 1 ? 'pack' : 'packs'}
                  </Text>
                </View>
                <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2">
                  <Text className="flex-1 text-[11px] text-slate-400" numberOfLines={1}>
                    Truck {ret.truckNumber || 'N/A'} {ret.driverName ? `• ${ret.driverName}` : ''}
                  </Text>
                  <Text className="text-[11px] font-bold text-slate-400">
                    {ret.returnedAt ? new Date(ret.returnedAt).toLocaleDateString([], { day: '2-digit', month: 'short' }) : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Section>

      {/* Super admin: average durations */}
      {isSuperAdmin && (
        <>
          <Section
            icon="clock"
            iconColor="#2563eb"
            title="Average Duration by Service / Part"
            right={serviceTimes.byPart?.length ? <Text className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">{serviceTimes.byPart.length} monitored</Text> : null}
          >
            {!serviceTimes.byPart?.length ? (
              <Text className="py-6 text-center text-xs text-slate-400">Not enough completed service sessions recorded to benchmark times.</Text>
            ) : (
              <DurationList items={serviceTimes.byPart} getLabel={(i) => i.partName} onPress={(i) => (i.partId ? () => go(`/parts/${i.partId}`) : null)} />
            )}
          </Section>
          <Section
            icon="user"
            iconColor="#9333ea"
            title="Average Duration by Technician"
            right={serviceTimes.byStaff?.length ? <Text className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">{serviceTimes.byStaff.length} technicians</Text> : null}
          >
            {!serviceTimes.byStaff?.length ? (
              <Text className="py-6 text-center text-xs text-slate-400">Not enough completed technician sessions recorded to benchmark times.</Text>
            ) : (
              <DurationList items={serviceTimes.byStaff} getLabel={(i) => i.staffName} onPress={(i) => (i.staffId ? () => go(`/staff/${i.staffId}`) : null)} />
            )}
          </Section>
        </>
      )}
    </ScrollView>
  );
}
