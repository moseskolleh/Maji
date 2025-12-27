import { PrismaClient, UserRole, ResourceType, AlertType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create zones (Freetown areas)
  const freetownZone = await prisma.zone.upsert({
    where: { slug: 'freetown' },
    update: {},
    create: {
      name: 'Freetown',
      slug: 'freetown',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-13.35, 8.35],
          [-13.35, 8.55],
          [-13.15, 8.55],
          [-13.15, 8.35],
          [-13.35, 8.35],
        ]],
      },
      centroid: {
        type: 'Point',
        coordinates: [-13.2343, 8.4657],
      },
    },
  });

  const zones = [
    {
      name: 'Kissy',
      slug: 'kissy',
      centroid: [-13.2150, 8.4800],
      schedule: { days: ['monday', 'thursday'], times: ['06:00-10:00'], reliability: 0.7 },
    },
    {
      name: 'Wellington',
      slug: 'wellington',
      centroid: [-13.1900, 8.4750],
      schedule: { days: ['tuesday', 'friday'], times: ['06:00-10:00'], reliability: 0.6 },
    },
    {
      name: 'Lumley',
      slug: 'lumley',
      centroid: [-13.2800, 8.4400],
      schedule: { days: ['monday', 'wednesday', 'friday'], times: ['07:00-11:00'], reliability: 0.8 },
    },
    {
      name: 'Congo Town',
      slug: 'congo-town',
      centroid: [-13.2400, 8.4500],
      schedule: { days: ['tuesday', 'saturday'], times: ['06:00-09:00'], reliability: 0.65 },
    },
    {
      name: 'Goderich',
      slug: 'goderich',
      centroid: [-13.2950, 8.4200],
      schedule: { days: ['wednesday', 'saturday'], times: ['08:00-12:00'], reliability: 0.75 },
    },
  ];

  for (const zone of zones) {
    await prisma.zone.upsert({
      where: { slug: zone.slug },
      update: {},
      create: {
        name: zone.name,
        slug: zone.slug,
        parentId: freetownZone.id,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [zone.centroid[0] - 0.02, zone.centroid[1] - 0.02],
            [zone.centroid[0] - 0.02, zone.centroid[1] + 0.02],
            [zone.centroid[0] + 0.02, zone.centroid[1] + 0.02],
            [zone.centroid[0] + 0.02, zone.centroid[1] - 0.02],
            [zone.centroid[0] - 0.02, zone.centroid[1] - 0.02],
          ]],
        },
        centroid: {
          type: 'Point',
          coordinates: zone.centroid,
        },
        waterSchedule: zone.schedule,
      },
    });
  }

  // Get created zones
  const kissyZone = await prisma.zone.findUnique({ where: { slug: 'kissy' } });
  const lumleyZone = await prisma.zone.findUnique({ where: { slug: 'lumley' } });
  const wellingtonZone = await prisma.zone.findUnique({ where: { slug: 'wellington' } });

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { phone: '+23276000000' },
    update: {},
    create: {
      phone: '+23276000000',
      name: 'Maji Admin',
      role: 'ADMIN',
      isVerified: true,
      reputation: 1000,
    },
  });

  // Create scout user
  const scout = await prisma.user.upsert({
    where: { phone: '+23276111111' },
    update: {},
    create: {
      phone: '+23276111111',
      name: 'Ibrahim Scout',
      role: 'SCOUT',
      isVerified: true,
      reputation: 450,
      primaryZoneId: kissyZone?.id,
    },
  });

  // Create vendor user
  const vendorUser = await prisma.user.upsert({
    where: { phone: '+23276222222' },
    update: {},
    create: {
      phone: '+23276222222',
      name: 'Abu Vendor',
      role: 'VENDOR',
      isVerified: true,
      reputation: 200,
      primaryZoneId: kissyZone?.id,
    },
  });

  // Create vendor profile
  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      userId: vendorUser.id,
      businessName: 'Abu Water Supply',
      description: 'Reliable water delivery since 2018. Fresh, clean water delivered to your door.',
      phone: '+23276222222',
      location: {
        type: 'Point',
        coordinates: [-13.2200, 8.4820],
      },
      address: '15 Main Street, Kissy',
      deliveryZones: [kissyZone?.id, wellingtonZone?.id].filter(Boolean) as string[],
      deliveryFee: 5000,
      minOrder: 10000,
      isVerified: true,
      isActive: true,
      rating: 4.5,
      ratingCount: 128,
      openingHours: {
        monday: { open: '06:00', close: '20:00' },
        tuesday: { open: '06:00', close: '20:00' },
        wednesday: { open: '06:00', close: '20:00' },
        thursday: { open: '06:00', close: '20:00' },
        friday: { open: '06:00', close: '20:00' },
        saturday: { open: '08:00', close: '18:00' },
        sunday: { open: '08:00', close: '14:00' },
      },
    },
  });

  // Create products for vendor
  const products = [
    { name: '20L Jerry Can', unit: '20L', price: 5000, description: 'Standard 20L jerry can of clean water' },
    { name: '50L Bucket', unit: '50L', price: 10000, description: 'Large 50L bucket for families' },
    { name: '10L Jerry Can', unit: '10L', price: 3000, description: 'Small 10L jerry can' },
    { name: 'Tanker (1000L)', unit: '1000L', price: 150000, description: 'Full tanker delivery for businesses' },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: {
        id: `${vendor.id}-${product.unit}`,
      },
      update: {},
      create: {
        id: `${vendor.id}-${product.unit}`,
        vendorId: vendor.id,
        name: product.name,
        unit: product.unit,
        price: product.price,
        description: product.description,
        isAvailable: true,
      },
    });
  }

  // Create resources
  if (kissyZone) {
    const resources = [
      {
        type: 'WATER_TAP' as ResourceType,
        name: 'Kissy Road Public Tap',
        location: { type: 'Point', coordinates: [-13.2180, 8.4815] },
        address: 'Kissy Road, near market',
        metadata: { hasQueue: false, estimatedWait: 10 },
      },
      {
        type: 'BOREHOLE' as ResourceType,
        name: 'Community Borehole',
        location: { type: 'Point', coordinates: [-13.2150, 8.4790] },
        address: 'Behind St. Johns Church',
        metadata: { depth: 50, pumpType: 'manual' },
      },
      {
        type: 'SOLAR_CHARGER' as ResourceType,
        name: 'Bright Solar Station',
        location: { type: 'Point', coordinates: [-13.2160, 8.4805] },
        address: 'Junction, Kissy Road',
        metadata: { pricePerHour: 1000, availablePorts: 6 },
      },
    ];

    for (const resource of resources) {
      await prisma.resource.create({
        data: {
          zoneId: kissyZone.id,
          type: resource.type,
          name: resource.name,
          location: resource.location,
          address: resource.address,
          metadata: resource.metadata,
          status: 'ACTIVE',
          lastVerified: new Date(),
        },
      });
    }
  }

  // Create sample alert
  if (kissyZone && scout) {
    await prisma.alert.create({
      data: {
        scoutId: scout.id,
        zoneId: kissyZone.id,
        type: 'WATER_COMING',
        message: 'Water supply confirmed by valve operator. Expected at 7:00 AM.',
        eta: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        duration: 120,
        confidence: 0.85,
        isVerified: true,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
    });
  }

  console.log('Seeding completed!');
  console.log('');
  console.log('Test users created:');
  console.log('  Admin:  +23276000000');
  console.log('  Scout:  +23276111111');
  console.log('  Vendor: +23276222222');
  console.log('');
  console.log('Use OTP: 123456 (in development mode)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
