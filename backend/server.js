const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

// Make io accessible in controllers
app.set('io', io);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('🔗 New Client Connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('❌ Client Disconnected:', socket.id);
  });
});

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));

// ========== API ROUTES ==========
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/menu', require('./routes/menu.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/tables', require('./routes/table.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/settings', require('./routes/settings.routes'));

// Health check
app.get('/', (req, res) => {
  res.send('🍕 Perfect Pizza API & Socket Server is running...');
});

// 404 handler for unknown APIs
app.use('/api', (req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});