// Simple test server without Prisma (uses raw pg)
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/maji',
});

const app = Fastify({ logger: true });

// Register plugins
app.register(cors, { origin: true });
app.register(jwt, { secret: 'test-secret-key' });

// Helper to generate OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper to generate ID
function generateId(prefix = '') {
  return prefix + Math.random().toString(36).substring(2, 15);
}

// Store OTPs in memory for testing
const otpStore = new Map();

// ============== AUTH ROUTES ==============

// POST /v1/auth/otp/request
app.post('/v1/auth/otp/request', async (request, reply) => {
  const { phone } = request.body;

  if (!phone || !phone.match(/^\+?232\d{8}$/)) {
    return reply.status(400).send({
      success: false,
      error: { code: 'E1001', message: 'Invalid phone number' }
    });
  }

  const otp = generateOtp();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 300000 });

  console.log(`[DEV] OTP for ${phone}: ${otp}`);

  return { success: true, message: 'OTP sent', expiresIn: 300 };
});

// POST /v1/auth/otp/verify
app.post('/v1/auth/otp/verify', async (request, reply) => {
  const { phone, otp } = request.body;

  const stored = otpStore.get(phone);

  // In dev mode, accept any 6-digit OTP
  if (!stored || (stored.otp !== otp && otp !== '123456')) {
    return reply.status(400).send({
      success: false,
      error: { code: 'E1002', message: 'Invalid OTP' }
    });
  }

  otpStore.delete(phone);

  // Find or create user
  let result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
  let user = result.rows[0];
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const id = generateId('usr_');
    await pool.query(
      'INSERT INTO users (id, phone, role) VALUES ($1, $2, $3)',
      [id, phone, 'CITIZEN']
    );
    result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    user = result.rows[0];
  }

  const accessToken = app.jwt.sign({ id: user.id, phone: user.phone, role: user.role });
  const refreshToken = app.jwt.sign({ id: user.id, type: 'refresh' }, { expiresIn: '30d' });

  return {
    success: true,
    accessToken,
    refreshToken,
    expiresIn: 86400,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      isNewUser,
    },
  };
});

// ============== USER ROUTES ==============

// GET /v1/users/me
app.get('/v1/users/me', async (request, reply) => {
  try {
    await request.jwtVerify();
    const { id } = request.user;

    const result = await pool.query(`
      SELECT u.*, z.id as zone_id, z.name as zone_name, z.slug as zone_slug
      FROM users u
      LEFT JOIN zones z ON u.primary_zone_id = z.id
      WHERE u.id = $1
    `, [id]);

    const user = result.rows[0];
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'E2001', message: 'User not found' }
      });
    }

    return {
      success: true,
      data: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        language: user.language,
        reputation: user.reputation,
        isVerified: user.is_verified,
        primaryZone: user.zone_id ? {
          id: user.zone_id,
          name: user.zone_name,
          slug: user.zone_slug,
        } : null,
        createdAt: user.created_at,
      },
    };
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: { code: 'E1005', message: 'Unauthorized' }
    });
  }
});

// ============== ZONE ROUTES ==============

// GET /v1/zones
app.get('/v1/zones', async (request, reply) => {
  const { parentId, search, page = 1, limit = 20 } = request.query;

  let query = 'SELECT * FROM zones WHERE 1=1';
  const params = [];

  if (parentId) {
    params.push(parentId);
    query += ` AND parent_id = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND name ILIKE $${params.length}`;
  }

  query += ' ORDER BY name';

  const result = await pool.query(query, params);

  return {
    success: true,
    data: result.rows.map(z => ({
      id: z.id,
      name: z.name,
      slug: z.slug,
      parentId: z.parent_id,
      centroid: z.centroid,
      waterSchedule: z.water_schedule,
    })),
    meta: { total: result.rows.length, page: parseInt(page), limit: parseInt(limit) },
  };
});

// GET /v1/zones/:id
app.get('/v1/zones/:id', async (request, reply) => {
  const { id } = request.params;

  const result = await pool.query('SELECT * FROM zones WHERE id = $1', [id]);
  const zone = result.rows[0];

  if (!zone) {
    return reply.status(404).send({
      success: false,
      error: { code: 'E3001', message: 'Zone not found' }
    });
  }

  return {
    success: true,
    data: {
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      parentId: zone.parent_id,
      centroid: zone.centroid,
      waterSchedule: zone.water_schedule,
    },
  };
});

// ============== ALERT ROUTES ==============

// GET /v1/alerts
app.get('/v1/alerts', async (request, reply) => {
  const { zoneId, type, status = 'ACTIVE' } = request.query;

  let query = `
    SELECT a.*, z.name as zone_name, z.slug as zone_slug, u.name as scout_name, u.reputation as scout_reputation
    FROM alerts a
    JOIN zones z ON a.zone_id = z.id
    JOIN users u ON a.scout_id = u.id
    WHERE a.status = $1
  `;
  const params = [status];

  if (zoneId) {
    params.push(zoneId);
    query += ` AND a.zone_id = $${params.length}`;
  }

  if (type) {
    params.push(type);
    query += ` AND a.type = $${params.length}`;
  }

  query += ' ORDER BY a.created_at DESC';

  const result = await pool.query(query, params);

  return {
    success: true,
    data: result.rows.map(a => ({
      id: a.id,
      type: a.type,
      message: a.message,
      zone: { id: a.zone_id, name: a.zone_name, slug: a.zone_slug },
      scout: { id: a.scout_id, name: a.scout_name, reputation: a.scout_reputation },
      eta: a.eta,
      duration: a.duration,
      confidence: a.confidence,
      isVerified: a.is_verified,
      status: a.status,
      createdAt: a.created_at,
    })),
  };
});

// ============== VENDOR ROUTES ==============

// GET /v1/vendors
app.get('/v1/vendors', async (request, reply) => {
  const { zoneId, minRating } = request.query;

  let query = `
    SELECT v.*, json_agg(json_build_object('id', p.id, 'name', p.name, 'unit', p.unit, 'price', p.price, 'isAvailable', p.is_available)) as products
    FROM vendors v
    LEFT JOIN products p ON p.vendor_id = v.id
    WHERE v.is_active = true AND v.is_verified = true
  `;
  const params = [];

  if (zoneId) {
    params.push(zoneId);
    query += ` AND $${params.length} = ANY(v.delivery_zones)`;
  }

  if (minRating) {
    params.push(parseFloat(minRating));
    query += ` AND v.rating >= $${params.length}`;
  }

  query += ' GROUP BY v.id ORDER BY v.rating DESC';

  const result = await pool.query(query, params);

  return {
    success: true,
    data: result.rows.map(v => ({
      id: v.id,
      businessName: v.business_name,
      description: v.description,
      phone: v.phone,
      location: v.location,
      address: v.address,
      rating: v.rating,
      ratingCount: v.rating_count,
      isVerified: v.is_verified,
      deliveryFee: v.delivery_fee,
      minOrder: v.min_order,
      products: v.products.filter(p => p.id !== null),
    })),
  };
});

// GET /v1/vendors/:id
app.get('/v1/vendors/:id', async (request, reply) => {
  const { id } = request.params;

  const vendorResult = await pool.query('SELECT * FROM vendors WHERE id = $1', [id]);
  const vendor = vendorResult.rows[0];

  if (!vendor) {
    return reply.status(404).send({
      success: false,
      error: { code: 'E4001', message: 'Vendor not found' }
    });
  }

  const productsResult = await pool.query('SELECT * FROM products WHERE vendor_id = $1', [id]);

  return {
    success: true,
    data: {
      id: vendor.id,
      businessName: vendor.business_name,
      description: vendor.description,
      phone: vendor.phone,
      location: vendor.location,
      address: vendor.address,
      rating: vendor.rating,
      ratingCount: vendor.rating_count,
      isVerified: vendor.is_verified,
      deliveryFee: vendor.delivery_fee,
      minOrder: vendor.min_order,
      openingHours: vendor.opening_hours,
      products: productsResult.rows.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        unit: p.unit,
        price: p.price,
        isAvailable: p.is_available,
      })),
    },
  };
});

// ============== HEALTH CHECK ==============

app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '1.0.0',
}));

// Start server
const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('\n🚀 Maji Test Server running at http://localhost:3000');
    console.log('📚 Endpoints available:');
    console.log('   GET  /health');
    console.log('   POST /v1/auth/otp/request');
    console.log('   POST /v1/auth/otp/verify');
    console.log('   GET  /v1/users/me');
    console.log('   GET  /v1/zones');
    console.log('   GET  /v1/zones/:id');
    console.log('   GET  /v1/alerts');
    console.log('   GET  /v1/vendors');
    console.log('   GET  /v1/vendors/:id');
    console.log('\n📝 Test with: curl http://localhost:3000/health\n');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
