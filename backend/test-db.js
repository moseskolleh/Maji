// Simple database and API test script
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/maji',
});

async function testDatabase() {
  console.log('🧪 Testing Maji Backend\n');

  try {
    // Test 1: Database connection
    console.log('1️⃣ Testing database connection...');
    await client.connect();
    console.log('   ✅ Connected to PostgreSQL\n');

    // Test 2: Create tables (simplified schema)
    console.log('2️⃣ Creating database schema...');
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'CITIZEN',
        language TEXT DEFAULT 'EN',
        avatar_url TEXT,
        reputation INT DEFAULT 0,
        is_verified BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        fcm_tokens TEXT[] DEFAULT '{}',
        primary_zone_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Zones table
      CREATE TABLE IF NOT EXISTS zones (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        geometry JSONB,
        centroid JSONB,
        parent_id TEXT REFERENCES zones(id),
        water_schedule JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- OTP codes table
      CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified BOOLEAN DEFAULT false,
        attempts INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Refresh tokens table
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Vendors table
      CREATE TABLE IF NOT EXISTS vendors (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        business_name TEXT NOT NULL,
        description TEXT,
        phone TEXT NOT NULL,
        location JSONB,
        address TEXT,
        delivery_zones TEXT[] DEFAULT '{}',
        delivery_fee INT DEFAULT 0,
        min_order INT DEFAULT 0,
        is_verified BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        rating FLOAT DEFAULT 0,
        rating_count INT DEFAULT 0,
        opening_hours JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Products table
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        unit TEXT NOT NULL,
        price INT NOT NULL,
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Alerts table
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        scout_id TEXT NOT NULL,
        zone_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT,
        eta TIMESTAMP,
        duration INT,
        confidence FLOAT DEFAULT 0.5,
        is_verified BOOLEAN DEFAULT false,
        feedback_score FLOAT,
        feedback_count INT DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   ✅ Schema created\n');

    // Test 3: Insert test data
    console.log('3️⃣ Inserting test data...');

    // Create Freetown zone
    await client.query(`
      INSERT INTO zones (id, name, slug, centroid, water_schedule)
      VALUES (
        'zone_freetown',
        'Freetown',
        'freetown',
        '{"type": "Point", "coordinates": [-13.2343, 8.4657]}'::jsonb,
        '{"days": ["monday", "thursday"], "times": ["06:00-10:00"], "reliability": 0.7}'::jsonb
      )
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Create Kissy zone
    await client.query(`
      INSERT INTO zones (id, name, slug, parent_id, centroid, water_schedule)
      VALUES (
        'zone_kissy',
        'Kissy',
        'kissy',
        'zone_freetown',
        '{"type": "Point", "coordinates": [-13.2150, 8.4800]}'::jsonb,
        '{"days": ["monday", "thursday"], "times": ["06:00-10:00"], "reliability": 0.7}'::jsonb
      )
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Create test admin user
    await client.query(`
      INSERT INTO users (id, phone, name, role, is_verified, reputation)
      VALUES (
        'usr_admin',
        '+23276000000',
        'Maji Admin',
        'ADMIN',
        true,
        1000
      )
      ON CONFLICT (phone) DO NOTHING;
    `);

    // Create test scout
    await client.query(`
      INSERT INTO users (id, phone, name, role, is_verified, reputation, primary_zone_id)
      VALUES (
        'usr_scout',
        '+23276111111',
        'Ibrahim Scout',
        'SCOUT',
        true,
        450,
        'zone_kissy'
      )
      ON CONFLICT (phone) DO NOTHING;
    `);

    // Create test vendor user
    await client.query(`
      INSERT INTO users (id, phone, name, role, is_verified, reputation, primary_zone_id)
      VALUES (
        'usr_vendor',
        '+23276222222',
        'Abu Vendor',
        'VENDOR',
        true,
        200,
        'zone_kissy'
      )
      ON CONFLICT (phone) DO NOTHING;
    `);

    // Create vendor profile
    await client.query(`
      INSERT INTO vendors (id, user_id, business_name, description, phone, location, address, delivery_zones, delivery_fee, min_order, is_verified, is_active, rating, rating_count)
      VALUES (
        'vnd_abu',
        'usr_vendor',
        'Abu Water Supply',
        'Reliable water delivery since 2018',
        '+23276222222',
        '{"type": "Point", "coordinates": [-13.2200, 8.4820]}'::jsonb,
        '15 Main Street, Kissy',
        ARRAY['zone_kissy'],
        5000,
        10000,
        true,
        true,
        4.5,
        128
      )
      ON CONFLICT (user_id) DO NOTHING;
    `);

    // Create products
    await client.query(`
      INSERT INTO products (id, vendor_id, name, unit, price, description)
      VALUES
        ('prd_20l', 'vnd_abu', '20L Jerry Can', '20L', 5000, 'Standard 20L jerry can'),
        ('prd_50l', 'vnd_abu', '50L Bucket', '50L', 10000, 'Large 50L bucket')
      ON CONFLICT DO NOTHING;
    `);

    // Create test alert
    await client.query(`
      INSERT INTO alerts (id, scout_id, zone_id, type, message, eta, duration, confidence, is_verified, status)
      VALUES (
        'alert_test',
        'usr_scout',
        'zone_kissy',
        'WATER_COMING',
        'Water supply confirmed by valve operator',
        NOW() + INTERVAL '2 hours',
        120,
        0.85,
        true,
        'ACTIVE'
      )
      ON CONFLICT DO NOTHING;
    `);

    console.log('   ✅ Test data inserted\n');

    // Test 4: Query test data
    console.log('4️⃣ Verifying data...');

    const zones = await client.query('SELECT id, name, slug FROM zones');
    console.log(`   📍 Zones: ${zones.rows.length}`);
    zones.rows.forEach(z => console.log(`      - ${z.name} (${z.slug})`));

    const users = await client.query('SELECT id, name, role, phone FROM users');
    console.log(`   👤 Users: ${users.rows.length}`);
    users.rows.forEach(u => console.log(`      - ${u.name} (${u.role}): ${u.phone}`));

    const vendors = await client.query('SELECT v.id, v.business_name, COUNT(p.id) as products FROM vendors v LEFT JOIN products p ON p.vendor_id = v.id GROUP BY v.id');
    console.log(`   🏪 Vendors: ${vendors.rows.length}`);
    vendors.rows.forEach(v => console.log(`      - ${v.business_name} (${v.products} products)`));

    const alerts = await client.query('SELECT id, type, status, message FROM alerts');
    console.log(`   🔔 Alerts: ${alerts.rows.length}`);
    alerts.rows.forEach(a => console.log(`      - [${a.type}] ${a.message}`));

    console.log('\n✅ All database tests passed!\n');

    // Print summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Database connection: OK');
    console.log('   ✅ Schema creation: OK');
    console.log('   ✅ Data insertion: OK');
    console.log('   ✅ Data querying: OK');
    console.log('\n🎉 Maji database is ready!\n');

    console.log('📝 Test Users:');
    console.log('   Admin:  +23276000000');
    console.log('   Scout:  +23276111111');
    console.log('   Vendor: +23276222222');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testDatabase();
