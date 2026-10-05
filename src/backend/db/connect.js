const mongoose = require("mongoose");
const { CONFIG } = require("../config");

let isConnected = false;
let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = CONFIG.MONGODB_URI;

  connectionPromise = (async () => {
    try {
      const conn = await mongoose.connect(uri, {
        bufferCommands: true, // Buffer commands gracefully so queries don't crash during reconnects
        serverSelectionTimeoutMS: 20000,
        connectTimeoutMS: 20000,
        socketTimeoutMS: 45000,
      });
      isConnected = true;
      console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn.connection;
    } catch (error) {
      console.error("❌ MongoDB Connection Error:", error.message);
      // If SRV lookup failed, try DNS fallback
      if (error.message.includes("ENOTFOUND") || error.message.includes("ETIMEDOUT")) {
        try {
          const dns = require("dns");
          dns.setServers(["8.8.8.8", "1.1.1.1"]);
          const conn = await mongoose.connect(uri, {
            bufferCommands: true,
            serverSelectionTimeoutMS: 20000,
            connectTimeoutMS: 20000,
          });
          isConnected = true;
          console.log(`✅ MongoDB Connected (via DNS fallback): ${conn.connection.host}/${conn.connection.name}`);
          return conn.connection;
        } catch (retryErr) {
          console.error("❌ MongoDB Connection Retry Error:", retryErr.message);
        }
      }
      return null;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.log("⚠️ MongoDB Disconnected. Retrying in background...");
  setTimeout(() => {
    if (mongoose.connection.readyState !== 1) {
      connectDB().catch(() => {});
    }
  }, 2000);
});

module.exports = { connectDB };
