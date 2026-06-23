require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const productRoutes = require("./routes/products");
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");

const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`🔌 Client connected via WebSocket: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(helmet());
app.use(compression());

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." }
});
app.use("/api", limiter);

app.use(cors({ origin: true }));
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/users", require("./routes/users"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/tickets", require("./routes/tickets"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/policies", require("./routes/policies"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/reviews", require("./routes/reviews"));
// Health check
app.get("/", (req, res) => {
  res.json({ message: "Downtown Boutique API is running!" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global error handler caught:", err);
  res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
});

// Connect to MongoDB and start server
const startServer = () => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    startServer();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    // Continue without DB
    startServer();
  });
