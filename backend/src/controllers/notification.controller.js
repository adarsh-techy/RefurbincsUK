const db = require('../config/db');

/**
 * Controller for Admin Notifications & Operational Alerts Hub
 */
async function getAdminNotifications(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 10), 300);

    // Parallel queries to fetch operational events and states
    const [
      { rows: lowStockParts },
      { rows: recentReturns },
      { rows: truckIntakes },
      { rows: openTickets },
      { rows: recentRatings },
      { rows: recentMilestones },
      { rows: unserviceableBatteries },
    ] = await Promise.all([
      // 1. Out of stock & low inventory parts (<= 5)
      db.query(
        `SELECT id, name, sku, quantity, in_stock, repair_cost
         FROM parts
         WHERE in_stock = false OR quantity <= 5
         ORDER BY (CASE WHEN in_stock = false OR quantity <= 0 THEN 0 ELSE 1 END), quantity ASC, name ASC
         LIMIT 30`
      ),

      // 2. Client return dispatches
      db.query(
        `SELECT ret.id, ret.truck_number, ret.driver_name, ret.battery_count, ret.returned_at, ret.created_at,
                c.id AS client_id, c.name AS client_name
         FROM returns ret
         LEFT JOIN clients c ON c.id = ret.client_id
         ORDER BY COALESCE(ret.returned_at, ret.created_at) DESC
         LIMIT 30`
      ),

      // 3. Truck intakes (pending verification or recently received)
      db.query(
        `SELECT ti.id, ti.truck_number, ti.driver_name, ti.battery_count, ti.status, ti.intake_at, ti.created_at, ti.verified_at,
                c.id AS client_id, c.name AS client_name
         FROM truck_intakes ti
         LEFT JOIN clients c ON c.id = ti.client_id
         ORDER BY ti.created_at DESC
         LIMIT 30`
      ),

      // 4. Open / active support tickets from clients
      db.query(
        `SELECT st.id, st.ticket_number, st.client_id, st.client_name, st.subject, st.category, st.priority, st.status,
                st.battery_code, st.created_at, st.updated_at,
                (SELECT COUNT(*)::int FROM support_ticket_messages stm WHERE stm.ticket_id = st.id) AS message_count
         FROM support_tickets st
         WHERE st.status != 'closed'
         ORDER BY (CASE st.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END),
                  st.updated_at DESC
         LIMIT 30`
      ),

      // 5. Client ratings and feedback
      db.query(
        `SELECT br.id, br.client_id, br.battery_code, br.rating, br.preset_tags, br.custom_feedback, br.created_at,
                c.name AS client_name
         FROM battery_ratings br
         LEFT JOIN clients c ON c.id = br.client_id
         ORDER BY br.created_at DESC
         LIMIT 30`
      ),

      // 6. Milestone ESG certificates issued
      db.query(
        `SELECT mc.id, mc.client_id, mc.milestone_tier, mc.milestone_count, mc.title, mc.co2_saved_kg, mc.ewaste_diverted_kg,
                mc.certificate_code, mc.issued_at,
                c.name AS client_name
         FROM milestone_certificates mc
         LEFT JOIN clients c ON c.id = mc.client_id
         ORDER BY mc.issued_at DESC
         LIMIT 30`
      ),

      // 7. Unserviceable scrap batteries awaiting recycling shipment
      db.query(
        `SELECT b.id, b.battery_code, b.client_name, b.created_at, b.notes
         FROM batteries b
         WHERE b.status = 'unserviceable'
           AND NOT EXISTS (SELECT 1 FROM recycle_batteries rb WHERE rb.battery_id = b.id)
         ORDER BY b.created_at DESC
         LIMIT 30`
      ),
    ]);

    // Build unified feed items
    const feed = [];

    // Map Low Stock
    lowStockParts.forEach((p) => {
      const isZero = !p.in_stock || Number(p.quantity) <= 0;
      feed.push({
        id: `stock_${p.id}`,
        type: 'stock',
        category: 'inventory',
        severity: isZero ? 'urgent' : 'warning',
        title: isZero ? `Out of Stock: ${p.name}` : `Low Stock Alert: ${p.name}`,
        message: isZero
          ? `Part "${p.name}" (SKU: ${p.sku || 'N/A'}) has reached 0 units in stock. Reorder immediately to avoid repair delays.`
          : `Part "${p.name}" (SKU: ${p.sku || 'N/A'}) is running low with only ${p.quantity} unit(s) remaining in stock.`,
        timestamp: p.created_at || new Date().toISOString(),
        actionLabel: 'Restock Part →',
        actionUrl: `/parts/${p.id}`,
        meta: {
          partId: p.id,
          partName: p.name,
          sku: p.sku,
          quantity: p.quantity,
          inStock: p.in_stock,
        },
      });
    });

    // Map Support Tickets
    openTickets.forEach((t) => {
      const isCritical = t.priority === 'critical' || t.priority === 'high';
      feed.push({
        id: `ticket_${t.id}`,
        type: 'ticket',
        category: 'support',
        severity: isCritical ? 'urgent' : 'info',
        title: `Client Inquiry [${t.ticket_number || `#${t.id}`}]: ${t.subject || 'Support Request'}`,
        message: `${t.client_name || 'Client'} submitted a ${t.priority || 'standard'} priority support ticket regarding ${t.category || 'battery issue'}${t.battery_code ? ` (Battery: ${t.battery_code})` : ''}. Status: ${t.status}.`,
        timestamp: t.updated_at || t.created_at,
        actionLabel: 'Open Conversation →',
        actionUrl: `/messages?ticket=${t.id}`,
        meta: {
          ticketId: t.id,
          ticketNumber: t.ticket_number,
          clientName: t.client_name,
          priority: t.priority,
          status: t.status,
          batteryCode: t.battery_code,
          messageCount: t.message_count,
        },
      });
    });

    // Map Truck Intakes
    truckIntakes.forEach((ti) => {
      const isPending = ti.status === 'draft' || ti.status === 'pending';
      feed.push({
        id: `intake_${ti.id}`,
        type: 'intake',
        category: 'logistics',
        severity: isPending ? 'warning' : 'info',
        title: isPending ? `Intake Pending Verification: Truck ${ti.truck_number}` : `Intake Verified: Truck ${ti.truck_number}`,
        message: `${ti.battery_count || 0} batteries received from ${ti.client_name || 'Fleet Client'} on Truck ${ti.truck_number || 'N/A'}${ti.driver_name ? ` (Driver: ${ti.driver_name})` : ''}. Status: ${ti.status || 'received'}.`,
        timestamp: ti.verified_at || ti.intake_at || ti.created_at,
        actionLabel: 'Inspect Truck Intake →',
        actionUrl: `/truck-intakes/${ti.id}`,
        meta: {
          intakeId: ti.id,
          truckNumber: ti.truck_number,
          driverName: ti.driver_name,
          batteryCount: ti.battery_count,
          status: ti.status,
          clientName: ti.client_name,
        },
      });
    });

    // Map Returns
    recentReturns.forEach((ret) => {
      feed.push({
        id: `return_${ret.id}`,
        type: 'return',
        category: 'logistics',
        severity: 'success',
        title: `Client Return Dispatched: ${ret.client_name || 'Fleet Client'}`,
        message: `${ret.battery_count || 0} serviced batteries dispatched on Truck ${ret.truck_number || 'N/A'}${ret.driver_name ? ` with Driver ${ret.driver_name}` : ''}.`,
        timestamp: ret.returned_at || ret.created_at,
        actionLabel: 'View Return Manifest →',
        actionUrl: `/returns/${ret.id}`,
        meta: {
          returnId: ret.id,
          truckNumber: ret.truck_number,
          driverName: ret.driver_name,
          batteryCount: ret.battery_count,
          clientName: ret.client_name,
          clientId: ret.client_id,
        },
      });
    });

    // Map Ratings
    recentRatings.forEach((r) => {
      const isLow = Number(r.rating) <= 2;
      feed.push({
        id: `rating_${r.id}`,
        type: 'rating',
        category: 'feedback',
        severity: isLow ? 'warning' : 'success',
        title: `${r.rating}★ Service Rating: ${r.client_name || 'Client Fleet'}`,
        message: `${r.client_name || 'Client'} rated repair service on ${r.battery_code || 'battery'}. Feedback: "${r.custom_feedback || (r.preset_tags && r.preset_tags.length ? r.preset_tags.join(', ') : 'High satisfaction')}"`,
        timestamp: r.created_at,
        actionLabel: 'View Review Detail →',
        actionUrl: `/ratings/${r.id}`,
        meta: {
          ratingId: r.id,
          rating: r.rating,
          batteryCode: r.battery_code,
          clientName: r.client_name,
        },
      });
    });

    // Map Milestones
    recentMilestones.forEach((m) => {
      feed.push({
        id: `milestone_${m.id}`,
        type: 'milestone',
        category: 'milestone',
        severity: 'success',
        title: `🏆 Milestone Awarded: ${m.milestone_tier} (${m.client_name || 'Client'})`,
        message: `${m.client_name || 'Client'} reached ${m.milestone_count} repaired batteries milestone! Diverted ${m.ewaste_diverted_kg}kg E-Waste and saved ${m.co2_saved_kg}kg CO₂.`,
        timestamp: m.issued_at,
        actionLabel: 'View Milestone Certificate →',
        actionUrl: `/certificates/client/${m.client_id}`,
        meta: {
          certificateId: m.id,
          certificateCode: m.certificate_code,
          tier: m.milestone_tier,
          count: m.milestone_count,
          clientName: m.client_name,
          clientId: m.client_id,
        },
      });
    });

    // Map Unserviceable Batteries
    if (unserviceableBatteries.length > 0) {
      feed.push({
        id: `unserviceable_summary`,
        type: 'unserviceable',
        category: 'alert',
        severity: 'warning',
        title: `⚠️ ${unserviceableBatteries.length} Unserviceable Batteries Awaiting Recycling`,
        message: `${unserviceableBatteries.length} scrap battery pack(s) are stored in the workshop pending batch shipment to certified recycling partners.`,
        timestamp: unserviceableBatteries[0]?.created_at || new Date().toISOString(),
        actionLabel: 'Manage Unserviceable →',
        actionUrl: `/batteries/unserviceable`,
        meta: {
          count: unserviceableBatteries.length,
          sampleCodes: unserviceableBatteries.slice(0, 5).map((b) => b.battery_code),
        },
      });
    }

    // Sort feed by timestamp descending
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Compute summary KPI counts
    const urgentItems = feed.filter((item) => item.severity === 'urgent');
    const warningItems = feed.filter((item) => item.severity === 'warning');

    const counts = {
      total: feed.length,
      urgent: urgentItems.length,
      warning: warningItems.length,
      inventory: lowStockParts.length,
      logistics: recentReturns.length + truckIntakes.length,
      support: openTickets.length,
      feedback: recentRatings.length,
      milestones: recentMilestones.length,
      unserviceable: unserviceableBatteries.length,
    };

    res.json({
      feed: feed.slice(0, limit),
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAdminNotifications,
};
