const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config();

function slugify(text) {
  if (!text) return '';
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Plan = mongoose.model('Plan', new mongoose.Schema({}, {strict: false}));
    const PlanPrice = mongoose.model('PlanPrice', new mongoose.Schema({}, {strict: false}));
    const StoreDetails = mongoose.model('StoreDetails', new mongoose.Schema({}, {strict: false}));
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, {strict: false}));

    // 1. Update Plans and Prices
    // Plan 1: Starter -> 5,000 NGN monthly, 50,000 NGN yearly
    const starterFeatures = JSON.stringify([
      'DASHBOARD',
      'POS',
      'ORDERS',
      'KITCHEN',
      'INVOICES',
      'SETTINGS',
      'REPORTS',
      'USER',
      'QRMENU'
    ]);

    await Plan.updateOne({ id: 1 }, {
      $set: {
        features: starterFeatures,
        yearly_discount: 17
      }
    });

    await PlanPrice.updateOne({ plan_id: 1, currency: 'NGN', frequency: 'monthly' }, { $set: { amount: 5000, is_default: true, is_active: true } });
    await PlanPrice.updateOne({ plan_id: 1, currency: 'NGN', frequency: 'yearly' }, { $set: { amount: 50000, is_default: true, is_active: true } });
    await PlanPrice.updateOne({ plan_id: 1, currency: 'USD', frequency: 'monthly' }, { $set: { amount: 5, is_default: false, is_active: true } });
    await PlanPrice.updateOne({ plan_id: 1, currency: 'USD', frequency: 'yearly' }, { $set: { amount: 50, is_default: false, is_active: true } });

    // Plan 2: Professional -> 12,000 NGN monthly, 115,000 NGN yearly
    await PlanPrice.updateOne({ plan_id: 2, currency: 'NGN', frequency: 'monthly' }, { $set: { amount: 12000, is_default: true, is_active: true } });
    await PlanPrice.updateOne({ plan_id: 2, currency: 'NGN', frequency: 'yearly' }, { $set: { amount: 115000, is_default: true, is_active: true } });
    await PlanPrice.updateOne({ plan_id: 2, currency: 'USD', frequency: 'monthly' }, { $set: { amount: 12, is_default: false, is_active: true } });
    await PlanPrice.updateOne({ plan_id: 2, currency: 'USD', frequency: 'yearly' }, { $set: { amount: 115, is_default: false, is_active: true } });

    // Plan 3: Enterprise -> 25,000 NGN monthly, 225,000 NGN yearly
    await PlanPrice.updateOne({ plan_id: 3, currency: 'NGN', frequency: 'monthly' }, { $set: { amount: 25000, is_default: true, is_active: true } });
    await PlanPrice.updateOne({ plan_id: 3, currency: 'NGN', frequency: 'yearly' }, { $set: { amount: 225000, is_default: true, is_active: true } });
    await PlanPrice.updateOne({ plan_id: 3, currency: 'USD', frequency: 'monthly' }, { $set: { amount: 25, is_default: false, is_active: true } });
    await PlanPrice.updateOne({ plan_id: 3, currency: 'USD', frequency: 'yearly' }, { $set: { amount: 225, is_default: false, is_active: true } });

    console.log('✅ Plans and prices successfully updated in MongoDB!');

    // 2. Update StoreDetails with slugs
    const stores = await StoreDetails.find().lean();
    for (const s of stores) {
      const slug = slugify(s.store_name) || ('store-' + s.tenant_id);
      const update = { slug };
      if (!s.unique_qr_code) {
        update.unique_qr_code = slug;
      }
      await StoreDetails.updateOne({ _id: s._id }, { $set: update });
      console.log(`Updated Store #${s.tenant_id} (${s.store_name}): slug = ${slug}`);
    }

    // 3. Make sure all tenants have active subscription status and unexpired date
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 2);

    await Tenant.updateMany(
      { is_active: 1 },
      {
        $set: {
          subscription_is_active: 1,
          subscription_end: farFuture.toISOString().split('T')[0]
        }
      }
    );

    console.log('✅ Active tenants verified and unexpired.');
    process.exit(0);
  } catch (err) {
    console.error('Error running update script:', err);
    process.exit(1);
  }
})();
