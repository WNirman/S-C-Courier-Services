import { apiUrl } from './apiBase.js';

export const DEFAULT_PRICING_RATES = {
    vehicleRates: {
        'Bike': 50,
        'Three-Wheeler': 75,
        'Car': 110,
        'Van': 150,
        'Lorry': 220
    },
    personalBaseFee: 250,
    personalPerKmRate: 60,
    updatedAt: null,
    updatedBy: 'admin@sccourier.com'
};

const STORAGE_KEY = 'sc_courier_pricing_rates';

export const getCachedPricingRates = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                ...DEFAULT_PRICING_RATES,
                ...parsed,
                vehicleRates: {
                    ...DEFAULT_PRICING_RATES.vehicleRates,
                    ...(parsed.vehicleRates || {})
                }
            };
        }
    } catch (e) {
        console.warn('Error reading cached pricing rates:', e);
    }
    return DEFAULT_PRICING_RATES;
};

export const fetchPricingRates = async () => {
    try {
        const res = await fetch(apiUrl('/api/pricing-rates'));
        if (res.ok) {
            const data = await res.json();
            const merged = {
                ...DEFAULT_PRICING_RATES,
                ...data,
                vehicleRates: {
                    ...DEFAULT_PRICING_RATES.vehicleRates,
                    ...(data.vehicleRates || {})
                }
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            return merged;
        }
    } catch (e) {
        // Fallback to localStorage / default when backend is offline
    }
    return getCachedPricingRates();
};

export const savePricingRates = async (newRates, updatedBy = 'admin@sccourier.com') => {
    const payload = {
        vehicleRates: {
            'Bike': Number(newRates.vehicleRates?.['Bike']) || 50,
            'Three-Wheeler': Number(newRates.vehicleRates?.['Three-Wheeler']) || 75,
            'Car': Number(newRates.vehicleRates?.['Car']) || 110,
            'Van': Number(newRates.vehicleRates?.['Van']) || 150,
            'Lorry': Number(newRates.vehicleRates?.['Lorry']) || 220,
        },
        personalBaseFee: Number(newRates.personalBaseFee) >= 0 ? Number(newRates.personalBaseFee) : 250,
        personalPerKmRate: Number(newRates.personalPerKmRate) >= 0 ? Number(newRates.personalPerKmRate) : 60,
        updatedAt: new Date().toISOString(),
        updatedBy
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    try {
        const res = await fetch(apiUrl('/api/pricing-rates'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const saved = await res.json();
            if (saved.rates) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.rates));
                return saved.rates;
            }
        }
    } catch (e) {
        console.warn('Backend offline; pricing rates saved in localStorage:', e);
    }

    return payload;
};
