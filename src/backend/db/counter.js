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

const getNextDailyTokenValue = async (tenantId) => {
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);
  const key = `token_tenant_${tenantId}_${todayStr}`;

  try {
    const counter = await Counter.findByIdAndUpdate(
      key,
      { $inc: { seq: 1 }, $set: { last_updated: now } },
      { new: true, upsert: true }
    );
    return counter.seq;
  } catch (error) {
    // If concurrent insert fails, retry once
    if (error.code === 11000) {
      const retryCounter = await Counter.findByIdAndUpdate(
        key,
        { $inc: { seq: 1 }, $set: { last_updated: now } },
        { new: true, upsert: true }
      );
      return retryCounter.seq;
    }
    throw error;
  }
};

module.exports = {
  Counter,
  getNextSequenceValue,
  getCurrentSequenceValue,
  getNextDailyTokenValue,
};
