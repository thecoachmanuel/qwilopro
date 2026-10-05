const mongoose = require("mongoose");
const { CONFIG } = require("../config");

let isConnected = false;

const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore in restricted environments
}

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = CONFIG.MONGODB_URI;

  try {
    const conn = await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    return null;
  }
};

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.log("⚠️ MongoDB Disconnected. Retrying...");
});

module.exports = { connectDB };
