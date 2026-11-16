import { DEFAULT_PRICING_RATES } from './pricingRates.js';
import { apiUrl } from './apiBase.js';

const LOCAL_LOCKS_KEY = 'sc_locked_actuals';

export function isFiniteNumber(val) {
  return val !== null && val !== undefined && val !== '' && Number.isFinite(Number(val));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeAtrEstimate(atr, pricingConfig = DEFAULT_PRICING_RATES) {
  const rateMap = pricingConfig?.vehicleRates || DEFAULT_PRICING_RATES.vehicleRates;
  const rate = Number(rateMap?.[atr?.vehicle_type]) || 100;
  const estDist = isFiniteNumber(atr?.estimated_distance) ? Number(atr.estimated_distance) : 0;
  const estCost = isFiniteNumber(atr?.estimated_cost)
    ? Number(atr.estimated_cost)
    : Number((estDist * rate).toFixed(2));
  return { estDist, estCost, rate, baseFee: 0 };
}

export function computePdEstimate(pd, pricingConfig = DEFAULT_PRICING_RATES) {
  const baseFee = Number(pricingConfig?.personalBaseFee) || 250;
  const perKmRate = Number(pricingConfig?.personalPerKmRate) || 60;

  let estDist = 5.0;
  if (isFiniteNumber(pd?.estimated_distance) && Number(pd.estimated_distance) > 0) {
    estDist = Number(pd.estimated_distance);
  } else if (pd?.pickup_lat && pd?.pickup_lng && pd?.drop_lat && pd?.drop_lng) {
    const pLat = parseFloat(pd.pickup_lat);
    const pLng = parseFloat(pd.pickup_lng);
    const dLat = parseFloat(pd.drop_lat);
    const dLng = parseFloat(pd.drop_lng);
    if (!Number.isNaN(pLat) && !Number.isNaN(pLng) && !Number.isNaN(dLat) && !Number.isNaN(dLng)) {
      const straightKm = haversineKm(pLat, pLng, dLat, dLng);
      estDist = Math.max(1.5, Number((straightKm * 1.25).toFixed(1)));
    }
  }

  let estCost;
  if (isFiniteNumber(pd?.estimated_cost) && Number(pd.estimated_cost) > 0) {
    estCost = Number(pd.estimated_cost);
  } else if (isFiniteNumber(pd?.cost) && Number(pd.cost) > 0) {
    estCost = Number(pd.cost);
  } else {
    estCost = Math.round(baseFee + estDist * perKmRate);
  }

  return { estDist, estCost, rate: perKmRate, baseFee };
}

/**
 * Resolves estimate vs actual vs lock state for an ATR or Personal Delivery item.
 * Ensures empty actual inputs start pre-filled with the order's estimated values.
 */
export function resolveOrderActualsState(type, item, lockedMap = {}, pricingConfig = DEFAULT_PRICING_RATES) {
  const normalizedType = type === 'atr' ? 'atr' : 'pd';
  const id = normalizedType === 'atr' ? item?.atr_id : item?.pd_id;
  const key = `${normalizedType}-${id}`;
  const lockRecord = lockedMap?.[key] || null;
  const isLocked = Boolean(lockRecord?.locked || item?.actuals_locked === true);

  const est = normalizedType === 'atr'
    ? computeAtrEstimate(item, pricingConfig)
    : computePdEstimate(item, pricingConfig);

  const rawActDist = lockRecord && isFiniteNumber(lockRecord.actual_distance)
    ? lockRecord.actual_distance
    : item?.actual_distance;
  const rawActCost = lockRecord && isFiniteNumber(lockRecord.actual_cost)
    ? lockRecord.actual_cost
    : item?.actual_cost;

  const hasActDist = isFiniteNumber(rawActDist) && (isLocked || Number(rawActDist) > 0);
  const hasActCost = isFiniteNumber(rawActCost) && (isLocked || Number(rawActCost) > 0);

  const actDist = hasActDist ? Number(rawActDist) : null;
  const actCost = hasActCost ? Number(rawActCost) : null;

  const startDist = actDist !== null ? String(actDist) : String(est.estDist);
  let startCost;
  if (actCost !== null) {
    startCost = String(actCost);
  } else if (actDist !== null) {
    startCost = calculateCostFromDistance(normalizedType, actDist, est.rate, est.baseFee);
  } else {
    startCost = String(est.estCost);
  }

  return {
    key,
    type: normalizedType,
    id,
    isLocked,
    lockRecord,
    estDist: est.estDist,
    estCost: est.estCost,
    rate: est.rate,
    baseFee: est.baseFee,
    actDist,
    actCost,
    startDist,
    startCost
  };
}

export function calculateCostFromDistance(type, distVal, rate, baseFee = 0) {
  const d = parseFloat(distVal);
  if (Number.isNaN(d) || d < 0) return '';
  if (type === 'pd') {
    return (Number(baseFee || 0) + d * Number(rate || 60)).toFixed(2);
  }
  return (d * Number(rate || 100)).toFixed(2);
}

function readLocalLocks() {
  try {
    const raw = localStorage.getItem(LOCAL_LOCKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalLocks(map) {
  try {
    localStorage.setItem(LOCAL_LOCKS_KEY, JSON.stringify(map || {}));
  } catch {
    /* ignore storage errors */
  }
}

export async function fetchLockedActuals() {
  const local = readLocalLocks();
  try {
    const res = await fetch(apiUrl('/api/actuals'));
    if (res.ok) {
      const data = await res.json();
      const merged = { ...local, ...(data.lockedActuals || {}) };
      writeLocalLocks(merged);
      return merged;
    }
  } catch {
    /* backend offline, return cached map */
  }
  return local;
}

export async function saveAndLockOrderActuals({
  type,
  item,
  actualDistance,
  actualCost,
  estDist,
  estCost,
  recordedBy,
  supabase
}) {
  const normalizedType = type === 'atr' ? 'atr' : 'pd';
  const id = normalizedType === 'atr' ? item.atr_id : item.pd_id;
  const reqKey = `${normalizedType}-${id}`;
  const distNum = Number(actualDistance);
  const costNum = Number(actualCost);

  if (!Number.isFinite(distNum) || distNum < 0 || !Number.isFinite(costNum) || costNum < 0) {
    throw new Error('Please enter valid non-negative numbers for actual distance and actual cost.');
  }

  // Primary path: save via backend so Supabase, lock store, and Corporate/Personal invoices stay in sync
  let backendHandled = false;
  try {
    const res = await fetch(apiUrl(`/api/actuals/${normalizedType}/${id}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actual_distance: distNum,
        actual_cost: costNum,
        estimated_distance: estDist,
        estimated_cost: estCost,
        recordedBy: recordedBy || 'Admin/Staff'
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      if (data.lockRecord) {
        const cache = readLocalLocks();
        cache[reqKey] = data.lockRecord;
        writeLocalLocks(cache);
      }
      throw new Error(data.error || 'Actual values for this order are already locked.');
    }
    if (!res.ok) {
      throw new Error(data.error || `Backend failed to save actuals (${res.status})`);
    }

    const cache = readLocalLocks();
    cache[reqKey] = data.lockRecord;
    writeLocalLocks(cache);
    backendHandled = true;
    return data;
  } catch (err) {
    if (backendHandled || /already locked/i.test(err.message) || /Backend failed/i.test(err.message)) {
      throw err;
    }
    // Network unreachable (backend server offline): fall back to direct Supabase update + local lock cache
  }

  const nowIso = new Date().toISOString();
  if (supabase) {
    if (normalizedType === 'atr') {
      const fullPayload = {
        actual_distance: distNum,
        actual_cost: costNum,
        status: 'Completed',
        actuals_locked: true,
        actuals_locked_by: recordedBy || 'Admin/Staff',
        actuals_locked_at: nowIso
      };
      const { error } = await supabase.from('atr').update(fullPayload).eq('atr_id', id);
      if (error) {
        const { error: fallbackErr } = await supabase
          .from('atr')
          .update({ actual_distance: distNum, actual_cost: costNum, status: 'Completed' })
          .eq('atr_id', id);
        if (fallbackErr) throw fallbackErr;
      }
    } else {
      const fullPayload = {
        status: 'Completed',
        estimated_distance: estDist,
        estimated_cost: estCost,
        actual_distance: distNum,
        actual_cost: costNum,
        actuals_locked: true,
        actuals_locked_by: recordedBy || 'Admin/Staff',
        actuals_locked_at: nowIso
      };
      const { error } = await supabase.from('personal_delivery').update(fullPayload).eq('pd_id', id);
      if (error) {
        const { error: fallbackErr } = await supabase
          .from('personal_delivery')
          .update({ status: 'Completed' })
          .eq('pd_id', id);
        if (fallbackErr) throw fallbackErr;
      }
    }
  }

  const lockRecord = {
    key: reqKey,
    source: normalizedType === 'atr' ? 'atr' : 'personal',
    id,
    estimated_distance: estDist,
    estimated_cost: estCost,
    actual_distance: distNum,
    actual_cost: costNum,
    locked: true,
    locked_by: recordedBy || 'Admin/Staff',
    locked_at: nowIso
  };
  const cache = readLocalLocks();
  cache[reqKey] = lockRecord;
  writeLocalLocks(cache);

  return {
    success: true,
    lockRecord,
    updatedInvoicesCount: 0,
    message: `Actual distance (${distNum} km) and actual cost (LKR ${costNum.toFixed(2)}) saved and locked.`
  };
}
