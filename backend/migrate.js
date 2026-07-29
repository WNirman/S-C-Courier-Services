require('dotenv').config();
const { Pool } = require('pg');
const url = require('url');

// Parse DATABASE_URL safely
let connectionConfig;
if (process.env.DATABASE_URL) {
  try {
    const params = url.parse(process.env.DATABASE_URL);
    const auth = params.auth ? params.auth.split(':') : [];
    connectionConfig = {
      user: auth[0] ? decodeURIComponent(auth[0]) : undefined,
      password: auth[1] ? decodeURIComponent(auth[1]) : undefined,
      host: params.hostname,
      port: params.port || 5432,
      database: params.pathname ? params.pathname.split('/')[1] : undefined,
      ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
    };
    console.log('Database URL parsed successfully. Host:', connectionConfig.host);
  } catch (err) {
    console.error('Error parsing DATABASE_URL, falling back to raw connectionString:', err.message);
    connectionConfig = { connectionString: process.env.DATABASE_URL };
  }
} else {
  console.error('DATABASE_URL is not set in environment variables!');
  process.exit(1);
}

const pool = new Pool(connectionConfig);

async function runMigration() {
  try {
    console.log('Connecting to PostgreSQL database...');
    const client = await pool.connect();
    console.log('Connected! Running migration queries...');

    await client.query(`
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS staff_dob DATE;
    `);
    console.log('Added staff_dob column (if it did not exist).');

    await client.query(`
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS personal_email VARCHAR(150);
    `);
    console.log('Added personal_email column (if it did not exist).');

    await client.query(`
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS staff_address TEXT;
    `);
    console.log('Added staff_address column (if it did not exist).');

    await client.query(`
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS availability_status VARCHAR(50) DEFAULT 'Available';
    `);
    console.log('Added availability_status column (if it did not exist).');

    await client.query(`
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS staff_avatar_url TEXT;
    `);
    console.log('Added staff_avatar_url column (if it did not exist).');

    client.release();
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await pool.end();
  }
}

runMigration();
