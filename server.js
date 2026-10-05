// Polyfill: Node.js v25 removed SlowBuffer, which breaks buffer-equal-constant-time (jsonwebtoken dep)
const _bufModule = require("buffer");
if (!_bufModule.SlowBuffer) {
  _bufModule.SlowBuffer = Buffer;
}

require("dotenv").config();
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const express = require("express");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const userAgent = require("express-useragent");
const morgan = require("morgan");
const cors = require("cors");
const i18n = require("i18n");
const path = require("path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const { connectDB } = require("./src/backend/db/connect");
const { seedDatabase } = require("./src/backend/db/seed");
const { CONFIG, LANGUAGES } = require("./src/backend/config");
const { getTenantIdFromQRCode } = require("./src/backend/services/settings.service");

// Routes
const authRoutes = require("./src/backend/routes/auth.routes");
const settingsRoutes = require("./src/backend/routes/settings.routes");
const customerRoutes = require("./src/backend/routes/customer.routes");
const reservationRoutes = require("./src/backend/routes/reservation.routes");
const userRoutes = require("./src/backend/routes/user.routes");
const menuItemRoutes = require("./src/backend/routes/menu_item.routes");
const posRoutes = require("./src/backend/routes/pos.routes");
const kitchenRoutes = require("./src/backend/routes/kitchen.routes");
const ordersRoutes = require("./src/backend/routes/orders.routes");
const invoiceRoutes = require("./src/backend/routes/invoice.routes");
const dashboardRoutes = require("./src/backend/routes/dashboard.routes");
const reportsRoutes = require("./src/backend/routes/reports.routes");
const qrMenuRoutes = require("./src/backend/routes/qrmenu.routes");
const feedbackRoutes = require("./src/backend/routes/feedback.routes");
const superAdminRoutes = require("./src/backend/routes/superadmin.routes");
const inventoryRoutes = require("./src/backend/routes/inventory.routes");
const planRoutes = require("./src/backend/routes/plans.routes");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

app.prepare().then(async () => {
  // Connect DB in background — don't block HTTP server startup
  connectDB().then(connected => {
    if (connected) seedDatabase().catch(console.error);
  }).catch(console.error);

  const server = express();

  // i18n configuration
  i18n.configure({
    locales: LANGUAGES,
    directory: path.join(__dirname, "translations", "locales"),
    defaultLocale: "en",
    cookie: "lang",
    queryParameter: "lang",
  });

  server.use(
    cors({
      credentials: true,
      origin: true,
    })
  );
  server.use(cookieParser());
  server.use(i18n.init);
  server.use(userAgent.express());
  server.use("/api/v1/auth/stripe-webhook", express.raw({ type: "application/json" }));
  server.use(express.json());
  server.use(
    fileUpload({
      preserveExtension: true,
      safeFileNames: true,
      useTempFiles: true,
      tempFileDir: path.join(__dirname, "tmp"),
    })
  );
  const fs = require("fs");
  server.use(
    "/public",
    express.static(path.resolve(process.cwd(), "public"), { maxAge: "7d" })
  );
  if (fs.existsSync(path.resolve(process.cwd(), "src", "public"))) {
    server.use(
      "/public",
      express.static(path.resolve(process.cwd(), "src", "public"), { maxAge: "7d" })
    );
  }
  server.use(morgan("tiny"));

  // Auto-connect / retry DB connection on API calls if not connected
  server.use("/api/v1", async (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  });

  // API Routes
  server.use("/api/v1/auth", authRoutes);
  server.use("/api/v1/settings", settingsRoutes);
  server.use("/api/v1/customers", customerRoutes);
  server.use("/api/v1/reservations", reservationRoutes);
  server.use("/api/v1/users", userRoutes);
  server.use("/api/v1/menu-items", menuItemRoutes);
  server.use("/api/v1/pos", posRoutes);
  server.use("/api/v1/kitchen", kitchenRoutes);
  server.use("/api/v1/orders", ordersRoutes);
  server.use("/api/v1/invoices", invoiceRoutes);
  server.use("/api/v1/dashboard", dashboardRoutes);
  server.use("/api/v1/reports", reportsRoutes);
  server.use("/api/v1/qrmenu", qrMenuRoutes);
  server.use("/api/v1/feedback", feedbackRoutes);
  server.use("/api/v1/superadmin", superAdminRoutes);
  server.use("/api/v1/admin", superAdminRoutes);
  server.use("/api/v1/inventory", inventoryRoutes);
  server.use("/api/v1/plans", planRoutes);

  // Fallback all other routes to Next.js App Router
  server.all("*", (req, res) => {
    const parsedUrl = parse(req.url, true);
    return handle(req, res, parsedUrl);
  });

  const httpServer = createServer(server);

  // Socket.IO attached to the same HTTP server
  const io = new Server(httpServer, {
    cors: {
      credentials: true,
      origin: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("authenticate", async (tenantId) => {
      if (tenantId) {
        socket.join(String(tenantId));
      }
    });

    socket.on("new_order_backend", (payload, tenantId) => {
      if (tenantId) {
        socket.to(String(tenantId)).emit("new_order", payload);
      }
    });

    socket.on("new_qrorder_backend", async (payload, qrcode) => {
      try {
        const tenantId = await getTenantIdFromQRCode(qrcode);
        if (tenantId) {
          socket.to(String(tenantId)).emit("new_qrorder", payload);
        }
      } catch (error) {
        console.error("Socket QR Order error:", error);
      }
    });

    socket.on("order_update_backend", (payload, tenantId) => {
      if (tenantId) {
        socket.to(String(tenantId)).emit("order_update", payload);
      }
    });

    socket.on("cart_update_backend", (payload, tenantId) => {
      if (tenantId) {
        socket.to(String(tenantId)).emit("cart_update", payload);
      }
    });

    socket.on("token_call_backend", (payload, tenantId) => {
      if (tenantId) {
        socket.to(String(tenantId)).emit("token_call", payload);
      }
    });

    socket.on("table_update_backend", (payload, tenantId) => {
      if (tenantId) {
        socket.to(String(tenantId)).emit("table_update", payload);
      }
    });
  });

  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Server ready on http://localhost:${PORT}`);
    // Retry DB seed after server is up (in case DB connected after server started)
    if (mongoose.connection.readyState === 1) {
      seedDatabase().catch(console.error);
    }
  });
});
