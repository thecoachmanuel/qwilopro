const mongoose = require("mongoose");
const { CONFIG } = require("../config");

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = CONFIG.MONGODB_URI;

  try {
    const conn = await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    // Don't kill process immediately so server can start and display diagnostic logs
    return null;
  }
};

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.log("⚠️ MongoDB Disconnected. Retrying...");
});

module.exports = { connectDB };
