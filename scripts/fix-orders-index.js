/**
 * Migration: Fix orders.client_request_id index
 * Root cause of: "Error processing your request now! Please try after sometime!"
 *
 * The unique compound index on { tenant_id, client_request_id } was stored in MongoDB
 * WITHOUT the sparse:true option. Because all POS orders have client_request_id=null,
 * only ONE order per tenant can ever be created before getting E11000 dup key.
 *
 * Fix: Drop the non-sparse index → recreate with sparse:true → null values excluded.
 */

const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const i = t.indexOf('=');
      if (i > 0) {
        const k = t.substring(0, i).trim();
        const v = t.substring(i + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const { connectDB } = require('./src/backend/db/connect');
const mongoose = require('mongoose');

async function fixIndex() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    console.error('Could not connect to MongoDB');
    process.exit(1);
  }

  const db = mongoose.connection.db;
  const collection = db.collection('orders');

  const indexes = await collection.indexes();
  console.log('\nCurrent indexes on "orders":');
  indexes.forEach(idx => {
    console.log(`  - ${idx.name}  sparse:${!!idx.sparse}  unique:${!!idx.unique}`);
  });

  const existingIndex = indexes.find(idx =>
    idx.name === 'tenant_id_1_client_request_id_1' ||
    (idx.key && idx.key.tenant_id === 1 && idx.key.client_request_id === 1)
  );

  if (existingIndex) {
    console.log(`\nDropping index "${existingIndex.name}"...`);
    await collection.dropIndex(existingIndex.name);
    console.log('✓ Dropped');
  }

  console.log('Recreating index with partialFilterExpression for client_request_id as string...');
  await collection.createIndex(
    { tenant_id: 1, client_request_id: 1 },
    {
      unique: true,
      partialFilterExpression: { client_request_id: { $type: "string" } },
      name: 'tenant_id_1_client_request_id_1'
    }
  );
  console.log('✓ Unique partial index created successfully!');

  console.log('\nVerification:');
  const updated = await collection.indexes();
  updated.forEach(idx => {
    console.log(`  - ${idx.name}  partialFilterExpression:${JSON.stringify(idx.partialFilterExpression)}  unique:${!!idx.unique}`);
  });

  console.log('\n✅ Migration complete! POS orders will now save without duplicate key collisions.');
  process.exit(0);
}

fixIndex().catch(e => {
  console.error('\n❌ FATAL:', e.message);
  process.exit(1);
});
