require('dotenv').config({ path: __dirname + '/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const checkAtrTable = async () => {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/atr?limit=1`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
                console.log('ATR Table Columns:', Object.keys(data[0]));
            } else {
                console.log('ATR table is empty, but query succeeded.');
            }
        } else {
            console.error('Failed to fetch ATR table:', await response.text());
        }
    } catch (err) {
        console.error('Error:', err);
    }
};

checkAtrTable();
