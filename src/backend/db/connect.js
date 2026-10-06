const mongoose = require("mongoose");
const { CONFIG } = require("../config");

const dns = require("dns");

// Proactively set reliable DNS servers ONLY on local Windows machines to ensure MongoDB Atlas SRV records resolve without Windows ISP DNS stalls. NEVER override on Linux / Vercel cloud environments!
if (process.platform === "win32" && !process.env.VERCEL) {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    // Ignore if restricted
  }
}

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
        family: 4, // Force IPv4 to prevent Windows Node.js dual-stack stalls/timeouts to Atlas
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
      });
      isConnected = true;
      console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn.connection;
    } catch (error) {
      console.error("❌ MongoDB Connection Error:", error.message);
      // If SRV lookup failed, try DNS fallback (on Windows)
      if (
        (process.platform === "win32" && !process.env.VERCEL) &&
        (error.message.includes("ENOTFOUND") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("querySrv"))
      ) {
        try {
          dns.setServers(["8.8.8.8", "1.1.1.1", "208.67.222.222"]);
          const conn = await mongoose.connect(uri, {
            bufferCommands: true,
            family: 4,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 30000,
            connectTimeoutMS: 30000,
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
