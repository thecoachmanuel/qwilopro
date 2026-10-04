const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
  last_updated: { type: Date, default: Date.now },
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

/**
 * Get next integer sequence value atomically
 * @param {string} sequenceName 
 * @returns {Promise<number>}
 */
const getNextSequenceValue = async (sequenceName) => {
  const counter = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

/**
 * Get current sequence value without incrementing
 * @param {string} sequenceName 
 * @returns {Promise<number>}
 */
const getCurrentSequenceValue = async (sequenceName) => {
  const counter = await Counter.findById(sequenceName);
  return counter ? counter.seq : 0;
};

/**
 * Get daily token sequence for restaurant orders, resetting to 1 on a new day
 * @param {number|string} tenantId 
 * @returns {Promise<number>}
 */
const getNextDailyTokenValue = async (tenantId) => {
  const key = `token_tenant_${tenantId}`;
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);

  const existing = await Counter.findById(key);

  if (!existing) {
    const created = await Counter.create({
      _id: key,
      seq: 1,
      last_updated: now,
    });
    return created.seq;
  }

  const lastUpdatedStr = new Date(existing.last_updated).toISOString().substring(0, 10);

  if (lastUpdatedStr !== todayStr) {
    // Reset to 1 for new day
    existing.seq = 1;
    existing.last_updated = now;
    await existing.save();
    return 1;
  }

  // Increment for today
  existing.seq += 1;
  existing.last_updated = now;
  await existing.save();
  return existing.seq;
};

module.exports = {
  Counter,
  getNextSequenceValue,
  getCurrentSequenceValue,
  getNextDailyTokenValue,
};
