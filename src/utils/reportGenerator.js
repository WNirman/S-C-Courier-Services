import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

/**
 * Normalizes date string into YYYY-MM
 */
const getYearMonth = (dateVal) => {
    if (!dateVal) return null;
    try {
        const str = String(dateVal).trim();
        if (/^\d{4}-\d{2}/.test(str)) {
            return str.substring(0, 7);
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return d.toISOString().substring(0, 7);
        }
    } catch (e) {
        // ignore parse error
    }
    return null;
};

/**
 * Checks if a given record date falls within target month (YYYY-MM).
 * If targetMonth is null or 'all', returns true.
 */
const matchesMonth = (dateVal, targetMonth) => {
    if (!targetMonth || targetMonth === 'all') return true;
    const ym = getYearMonth(dateVal);
    return ym === targetMonth;
};

/**
 * Format currency in LKR
 */
const fmtMoney = (amount) => {
    const num = Number(amount) || 0;
    return num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Auto-fit column widths for SheetJS worksheets
 */
const autoFitColumns = (dataAoA) => {
    const colWidths = [];
    dataAoA.forEach(row => {
        if (!Array.isArray(row)) return;
        row.forEach((cell, colIdx) => {
            const strVal = (cell !== null && cell !== undefined) ? String(cell) : '';
            const length = strVal.length;
            colWidths[colIdx] = Math.max(colWidths[colIdx] || 12, Math.min(length + 3, 60));
        });
    });
    return colWidths.map(w => ({ wch: w }));
};

/**
 * Generate Comprehensive Monthly Statistical & Analytical Excel Workbook
 * @param {string} targetMonth - Format 'YYYY-MM' (e.g. '2026-09') or 'all'
 * @param {object|string} user - Currently logged in user details
 */
export const generateMonthlyExcelReport = async (targetMonth = null, user = null) => {
    // 1. Fetch complete data from Supabase
    const [
        staffRes,
        riderRes,
        atrRes,
        pdRes,
        courierRes,
        customerRes,
        invoiceRes,
        paymentRes,
        deptRes
    ] = await Promise.all([
        supabase.from('staff').select('*'),
        supabase.from('rider').select('*'),
        supabase.from('atr').select('*'),
        supabase.from('personal_delivery').select('*'),
        supabase.from('courier_req').select('*'),
        supabase.from('customer').select('*'),
        supabase.from('invoice').select('*'),
        supabase.from('payment').select('*'),
        supabase.from('department').select('dep_id, dep_name, comp_id, company(comp_id, comp_name)')
    ]);

    const staffAll = staffRes.data || [];
    const riderAll = riderRes.data || [];
    const atrAll = atrRes.data || [];
    const pdAll = pdRes.data || [];
    const courierAll = courierRes.data || [];
    const customerAll = customerRes.data || [];
    const invoiceAll = invoiceRes.data || [];
    const paymentAll = paymentRes.data || [];
    const deptAll = deptRes.data || [];

    // Build Department / Company Map
    const deptMap = {};
    deptAll.forEach(d => {
        deptMap[d.dep_id] = {
            depName: d.dep_name || 'Operations',
            compName: d.company?.comp_name || 'Corporate Client'
        };
    });

    // Build Rider Map (NIC -> Rider info)
    const riderMap = {};
    riderAll.forEach(r => {
        riderMap[r.NIC] = r;
    });

    // Determine target month label
    const selectedMonth = targetMonth && targetMonth !== 'all' ? targetMonth : null;
    const monthLabel = selectedMonth
        ? new Date(`${selectedMonth}-01`).toLocaleString('default', { month: 'long', year: 'numeric' })
        : 'All Available Periods';

    // 2. Filter Operations for the specific Month
    const atrFiltered = atrAll.filter(a => {
        return matchesMonth(a.required_date || a.approval_date || a.created_at, selectedMonth);
    });

    const pdFiltered = pdAll.filter(p => {
        return matchesMonth(p.requested_date || p.scheduled_date || p.accepted_at || p.created_at, selectedMonth);
    });

    const courierFiltered = courierAll.filter(c => {
        return matchesMonth(c.courier_date || c.created_at, selectedMonth);
    });

    const invoiceFiltered = invoiceAll.filter(i => {
        return matchesMonth(i.issue_date || i.billing_period_start || i.created_at, selectedMonth);
    });

    const paymentFiltered = paymentAll.filter(p => {
        return matchesMonth(p.payment_date, selectedMonth);
    });

    // 3. Compute High-Level Statistics & Analytics
    const totalAtrCount = atrFiltered.length;
    const completedAtrCount = atrFiltered.filter(a => a.status?.toLowerCase() === 'completed').length;
    const approvedAtrCount = atrFiltered.filter(a => a.status?.toLowerCase() === 'approved' || a.status?.toLowerCase() === 'assigned').length;
    const pendingAtrCount = atrFiltered.filter(a => a.status?.toLowerCase() === 'pending').length;

    const totalAtrEstCost = atrFiltered.reduce((acc, a) => acc + (Number(a.estimated_cost) || 0), 0);
    const totalAtrActCost = atrFiltered.reduce((acc, a) => acc + (Number(a.actual_cost) || 0), 0);
    const totalAtrEstDist = atrFiltered.reduce((acc, a) => acc + (Number(a.estimated_distance) || 0), 0);
    const totalAtrActDist = atrFiltered.reduce((acc, a) => acc + (Number(a.actual_distance) || 0), 0);
    const costVariance = totalAtrActCost - totalAtrEstCost;
    const costVariancePct = totalAtrEstCost > 0 ? ((costVariance / totalAtrEstCost) * 100).toFixed(2) : '0.00';

    const totalPdCount = pdFiltered.length;
    const completedPdCount = pdFiltered.filter(p => p.status?.toLowerCase() === 'completed' || p.status?.toLowerCase() === 'delivered').length;
    const assignedPdCount = pdFiltered.filter(p => p.status?.toLowerCase() === 'assigned' || p.status?.toLowerCase() === 'in transit' || p.status?.toLowerCase() === 'accepted').length;
    const pendingPdCount = pdFiltered.filter(p => p.status?.toLowerCase() === 'pending').length;
    const totalPdRevenue = pdFiltered.reduce((acc, p) => acc + (Number(p.cost) || 0), 0);

    const totalCouriersCount = courierFiltered.length;
    const deliveredCouriers = courierFiltered.filter(c => c.status?.toLowerCase() === 'delivered').length;

    const totalOperationsVolume = totalAtrCount + totalPdCount + totalCouriersCount;
    const totalCompletedOperations = completedAtrCount + completedPdCount + deliveredCouriers;
    const overallSuccessRate = totalOperationsVolume > 0
        ? ((totalCompletedOperations / totalOperationsVolume) * 100).toFixed(1)
        : '0.0';

    // Financial calculations
    const totalInvoiced = invoiceFiltered.reduce((acc, i) => acc + (Number(i.total_amount) || 0), 0);
    const totalPaid = paymentFiltered
        .filter(p => ['success', 'paid'].includes((p.status || '').toLowerCase()))
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);

    // Vehicle breakdown
    const vehicleStats = {};
    const recordVehicle = (type, cost) => {
        const v = type || 'Standard / Unspecified';
        if (!vehicleStats[v]) vehicleStats[v] = { trips: 0, cost: 0 };
        vehicleStats[v].trips += 1;
        vehicleStats[v].cost += Number(cost) || 0;
    };
    atrFiltered.forEach(a => recordVehicle(a.vehicle_type, a.actual_cost || a.estimated_cost));
    pdFiltered.forEach(p => recordVehicle(p.vehicle_type, p.cost));

    // Rider performance calculations for the month
    const riderPerfMap = {};
    riderAll.forEach(r => {
        riderPerfMap[r.NIC] = {
            nic: r.NIC,
            name: r.Name || 'Unknown Rider',
            phone: r.Phone_Number || 'N/A',
            email: r.email || 'N/A',
            branch: r.Branch || 'Main Branch',
            vehicleType: r.Vehicle_Type || 'N/A',
            vehicleNumber: r.Vehicle_Number || 'N/A',
            status: r.availability_status || 'Available',
            assignedTrips: 0,
            completedTrips: 0,
            revenueHandled: 0,
            distanceCovered: 0
        };
    });

    atrFiltered.forEach(a => {
        const rNic = a.assigned_rider_nic;
        if (rNic && riderPerfMap[rNic]) {
            riderPerfMap[rNic].assignedTrips += 1;
            if (a.status?.toLowerCase() === 'completed') {
                riderPerfMap[rNic].completedTrips += 1;
            }
            riderPerfMap[rNic].revenueHandled += Number(a.actual_cost || a.estimated_cost || 0);
            riderPerfMap[rNic].distanceCovered += Number(a.actual_distance || a.estimated_distance || 0);
        }
    });

    pdFiltered.forEach(p => {
        const rNic = p.assigned_rider_nic;
        if (rNic && riderPerfMap[rNic]) {
            riderPerfMap[rNic].assignedTrips += 1;
            if (['completed', 'delivered'].includes((p.status || '').toLowerCase())) {
                riderPerfMap[rNic].completedTrips += 1;
            }
            riderPerfMap[rNic].revenueHandled += Number(p.cost || 0);
        }
    });

    const activeRidersInMonth = Object.values(riderPerfMap).filter(r => r.assignedTrips > 0);

    // ==========================================
    // SHEET 1: Monthly Overview & Analytics
    // ==========================================
    const userEmail = typeof user === 'string' ? user : (user?.email || user?.staff_email || 'Staff / Admin');
    const overviewData = [
        ['S&C COURIER SERVICES - MONTHLY STATISTICAL & ANALYTICAL REPORT'],
        ['Report Scope:', monthLabel],
        ['Generated Date & Time:', new Date().toLocaleString()],
        ['Generated By:', userEmail],
        ['System Mode:', 'Production Multi-Service Logistics Management'],
        [],
        ['=== 1. EXECUTIVE LOGISTICS & FINANCIAL KPIS ==='],
        ['Key Metric Indicator', 'Value (This Month)', 'Target / Unit', 'Notes / Context'],
        ['Total Logistics Operations Volume', totalOperationsVolume, 'Trips / Bookings', 'Sum of ATR, Personal Deliveries & Couriers'],
        ['Completed Operations Count', totalCompletedOperations, 'Delivered / Completed', 'Successfully fulfilled jobs'],
        ['Operations Completion Rate', `${overallSuccessRate}%`, 'Benchmark: > 90%', 'Overall operational fulfillment rate'],
        ['Total Invoiced Amount (LKR)', fmtMoney(totalInvoiced), 'LKR (Currency)', 'Total billed to clients and customers'],
        ['Total Payments Collected (LKR)', fmtMoney(totalPaid), 'LKR (Currency)', 'Confirmed receipts and digital payments'],
        ['Total Outstanding Balance (LKR)', fmtMoney(totalOutstanding), 'LKR (Currency)', 'Pending client receivables'],
        ['Personal Courier Deliveries Revenue', fmtMoney(totalPdRevenue), 'LKR (Currency)', 'Direct individual courier charges'],
        ['ATR Corporate Estimated Cost', fmtMoney(totalAtrEstCost), 'LKR (Currency)', 'Initial cost projections for ATRs'],
        ['ATR Corporate Actual Cost', fmtMoney(totalAtrActCost), 'LKR (Currency)', 'Final recorded expenses upon completion'],
        ['Cost Budget Variance (LKR)', fmtMoney(costVariance), 'LKR (Currency)', costVariance > 0 ? 'Over budget' : 'Within budget'],
        ['Cost Budget Variance (%)', `${costVariancePct}%`, '% Variance', costVariance > 0 ? 'Cost escalation' : 'Cost efficiency'],
        ['Total Distance Covered (ATR Trips)', `${totalAtrActDist > 0 ? totalAtrActDist : totalAtrEstDist} km`, 'Kilometers', 'Distance traversed by assigned fleet'],
        ['Active Riders Operating This Month', activeRidersInMonth.length, 'Riders', `Out of ${riderAll.length} registered riders`],
        [],
        ['=== 2. OPERATIONS BREAKDOWN BY STATUS ==='],
        ['Service Stream', 'Total Requests', 'Completed', 'Assigned / In Transit', 'Pending / Under Review'],
        ['ATR Corporate Travel Assignments', totalAtrCount, completedAtrCount, approvedAtrCount, pendingAtrCount],
        ['Personal Deliveries (Courier)', totalPdCount, completedPdCount, assignedPdCount, pendingPdCount],
        ['Standard Courier Requests', totalCouriersCount, deliveredCouriers, totalCouriersCount - deliveredCouriers, 0],
        ['TOTAL CONSOLIDATED', totalOperationsVolume, totalCompletedOperations, approvedAtrCount + assignedPdCount, pendingAtrCount + pendingPdCount],
        [],
        ['=== 3. VEHICLE FLEET UTILIZATION & REVENUE ==='],
        ['Vehicle Category', 'Trips Handled', 'Total Value / Revenue (LKR)', 'Average Cost Per Trip (LKR)'],
        ...Object.entries(vehicleStats).map(([vType, data]) => [
            vType,
            data.trips,
            fmtMoney(data.cost),
            data.trips > 0 ? fmtMoney(data.cost / data.trips) : '0.00'
        ]),
        [],
        ['=== 4. TOP PERFORMING RIDERS (THIS MONTH) ==='],
        ['Rider NIC', 'Rider Name', 'Vehicle Type', 'Trips Assigned', 'Trips Completed', 'Success Rate', 'Total Revenue Handled (LKR)'],
        ...Object.values(riderPerfMap)
            .sort((a, b) => b.completedTrips - a.completedTrips || b.revenueHandled - a.revenueHandled)
            .slice(0, 10)
            .map(r => [
                r.nic,
                r.name,
                r.vehicleType,
                r.assignedTrips,
                r.completedTrips,
                r.assignedTrips > 0 ? `${((r.completedTrips / r.assignedTrips) * 100).toFixed(1)}%` : 'N/A',
                fmtMoney(r.revenueHandled)
            ])
    ];

    // ==========================================
    // SHEET 2: Deliveries & Couriers
    // ==========================================
    const deliveryHeaders = [
        'Booking ID', 'Type', 'Date', 'Sender Name', 'Sender Phone',
        'Receiver Name', 'Receiver Phone', 'Pickup Address', 'Drop Address',
        'Item Details', 'Vehicle Required', 'Cost (LKR)', 'Assigned Rider', 'Rider Contact', 'Status'
    ];
    const deliveryRows = [
        deliveryHeaders,
        ...pdFiltered.map(p => {
            const rider = riderMap[p.assigned_rider_nic];
            return [
                `PD-${p.pd_id}`,
                'Personal Delivery',
                p.requested_date || p.scheduled_date || (p.created_at ? p.created_at.split('T')[0] : 'N/A'),
                p.sender_name || 'N/A',
                p.sender_phone || 'N/A',
                p.receiver_name || 'N/A',
                p.receiver_phone || 'N/A',
                p.pickup_address || 'N/A',
                p.drop_address || 'N/A',
                `${p.item_type || 'Package'} (${p.item_weight || 'Standard'})`,
                p.vehicle_type || 'Standard',
                p.cost ? Number(p.cost) : 0,
                rider ? rider.Name : (p.assigned_rider_nic || 'Unassigned'),
                rider ? rider.Phone_Number : 'N/A',
                p.status || 'Pending'
            ];
        }),
        ...courierFiltered.map(c => [
            `CR-${c.book_id}`,
            'Standard Courier',
            c.courier_date || (c.created_at ? c.created_at.split('T')[0] : 'N/A'),
            `Customer ID: ${c.customer_id}`,
            'N/A',
            `Receiver NIC: ${c.rec_nic}`,
            'N/A',
            'N/A',
            'N/A',
            `Weight: ${c.courier_weight || 'N/A'}`,
            'Motorbike',
            0,
            'Fleet Dispatch',
            'N/A',
            c.status || 'Pending'
        ])
    ];

    // ==========================================
    // SHEET 3: ATR Travel Requests
    // ==========================================
    const atrHeaders = [
        'ATR ID', 'ATR Number', 'Company / Client', 'Department', 'Passenger Name',
        'Designation', 'Required Date', 'Required Time', 'Vehicle Type', 'Purpose of Travel',
        'Est. Dist (km)', 'Est. Cost (LKR)', 'Actual Dist (km)', 'Actual Cost (LKR)', 'Cost Variance (LKR)',
        'Assigned Rider', 'Status', 'Approval Date'
    ];
    const atrRows = [
        atrHeaders,
        ...atrFiltered.map(a => {
            const dept = deptMap[a.dep_id] || { depName: 'N/A', compName: 'Corporate Client' };
            const rider = riderMap[a.assigned_rider_nic];
            const estCost = Number(a.estimated_cost) || 0;
            const actCost = Number(a.actual_cost) || 0;
            const varCost = actCost > 0 ? actCost - estCost : 0;
            return [
                a.atr_id,
                a.atr_number || `ATR-${a.atr_id}`,
                dept.compName,
                dept.depName,
                a.principal_passenger_name || 'N/A',
                a.principal_passenger_designation || 'N/A',
                a.required_date || 'N/A',
                a.required_time || 'N/A',
                a.vehicle_type || 'Standard',
                a.purpose_of_travel || 'N/A',
                Number(a.estimated_distance) || 0,
                estCost,
                Number(a.actual_distance) || 0,
                actCost,
                varCost,
                rider ? `${rider.Name} (${rider.NIC})` : (a.assigned_rider_nic || 'Unassigned'),
                a.status || 'Pending',
                a.approval_date ? new Date(a.approval_date).toLocaleDateString() : 'N/A'
            ];
        })
    ];

    // ==========================================
    // SHEET 4: Invoices & Financials
    // ==========================================
    const invoiceHeaders = [
        'Invoice ID', 'Type', 'Customer ID', 'Issue Date', 'Billing Period Start',
        'Billing Period End', 'Total Amount (LKR)', 'Payment Status'
    ];
    const invoiceRows = [
        ['=== MONTHLY INVOICES LEDGER ==='],
        invoiceHeaders,
        ...invoiceFiltered.map(i => [
            i.invoice_id,
            i.invoice_type || 'Standard',
            i.customer_id || 'N/A',
            i.issue_date || 'N/A',
            i.billing_period_start || 'N/A',
            i.billing_period_end || 'N/A',
            Number(i.total_amount) || 0,
            i.payment_status || 'Unpaid'
        ]),
        [],
        ['=== PAYMENT RECEIPTS & TRANSACTIONS ==='],
        ['Payment ID', 'Invoice ID', 'Payment Date', 'Payment Method', 'Amount (LKR)', 'Transaction Status', 'Transaction Reference'],
        ...paymentFiltered.map(p => [
            p.payment_id,
            p.invoice_id,
            p.payment_date ? new Date(p.payment_date).toLocaleString() : 'N/A',
            p.payment_method || 'Cash / Online',
            Number(p.amount) || 0,
            p.status || 'Success',
            p.transaction_id || 'N/A'
        ])
    ];

    // ==========================================
    // SHEET 5: Fleet & Rider Performance
    // ==========================================
    const riderHeaders = [
        'Rider NIC', 'Full Name', 'Phone Number', 'Email', 'Branch',
        'Vehicle Type', 'Vehicle Number', 'Licence Number', 'Current Status',
        'Trips Assigned (Month)', 'Trips Completed (Month)', 'Fulfillment Rate', 'Total Revenue Handled (LKR)'
    ];
    const riderRows = [
        riderHeaders,
        ...Object.values(riderPerfMap).map(r => [
            r.nic,
            r.name,
            r.phone,
            r.email,
            r.branch,
            r.vehicleType,
            r.vehicleNumber,
            riderMap[r.nic]?.Driver_Licence_No || 'N/A',
            r.status,
            r.assignedTrips,
            r.completedTrips,
            r.assignedTrips > 0 ? `${((r.completedTrips / r.assignedTrips) * 100).toFixed(1)}%` : '0.0%',
            r.revenueHandled
        ])
    ];

    // ==========================================
    // SHEET 6: Customers & Staff Directory
    // ==========================================
    const directoryRows = [
        ['=== ACTIVE OFFICE STAFF & DISPATCHERS ==='],
        ['Staff ID', 'Name', 'Email Address', 'Phone Number', 'Designation / Role', 'Status'],
        ...staffAll.map(s => [
            s.staff_id,
            s.staff_name,
            s.staff_email,
            s.staff_phone,
            s.staff_role || 'Staff',
            s.staff_active_status ? 'Active' : 'Inactive'
        ]),
        [],
        ['=== REGISTERED CLIENTS & CUSTOMERS ==='],
        ['Customer ID', 'Full Name', 'Email Address', 'Phone Number', 'Delivery Address', 'Customer Type', 'Registered Date'],
        ...customerAll.map(c => [
            c.customer_id,
            c.cust_name || 'N/A',
            c.cust_email || 'N/A',
            c.cust_phoneNo || 'N/A',
            c.cust_address || 'N/A',
            c.cust_type || 'Individual',
            c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'
        ])
    ];

    // Build Workbook
    const wb = XLSX.utils.book_new();

    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    wsOverview['!cols'] = autoFitColumns(overviewData);
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Monthly Summary');

    const wsDeliveries = XLSX.utils.aoa_to_sheet(deliveryRows);
    wsDeliveries['!cols'] = autoFitColumns(deliveryRows);
    XLSX.utils.book_append_sheet(wb, wsDeliveries, 'Deliveries & Couriers');

    const wsAtr = XLSX.utils.aoa_to_sheet(atrRows);
    wsAtr['!cols'] = autoFitColumns(atrRows);
    XLSX.utils.book_append_sheet(wb, wsAtr, 'ATR Travel Requests');

    const wsInvoices = XLSX.utils.aoa_to_sheet(invoiceRows);
    wsInvoices['!cols'] = autoFitColumns(invoiceRows);
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices & Financials');

    const wsRiders = XLSX.utils.aoa_to_sheet(riderRows);
    wsRiders['!cols'] = autoFitColumns(riderRows);
    XLSX.utils.book_append_sheet(wb, wsRiders, 'Fleet & Rider Performance');

    const wsDirectory = XLSX.utils.aoa_to_sheet(directoryRows);
    wsDirectory['!cols'] = autoFitColumns(directoryRows);
    XLSX.utils.book_append_sheet(wb, wsDirectory, 'Staff & Customers');

    // Generate file name
    const fileMonthSlug = selectedMonth ? selectedMonth.replace('-', '_') : 'All_Time';
    const fileName = `SC_Courier_Monthly_Report_${fileMonthSlug}.xlsx`;

    // Trigger download
    XLSX.writeFile(wb, fileName);
    return { success: true, fileName, totalRecords: totalOperationsVolume };
};
