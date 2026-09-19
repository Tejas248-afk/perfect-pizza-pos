const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
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
    origin: '*', // Allows all for local and cloud usage
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

// Make io accessible globally in controllers
app.set('io', io);

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log('🔗 New Client Connected to Socket:', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ Client Disconnected:', socket.id);
  });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));

// =====================================
// FRONTEND HOSTING (FOR DEPLOYMENT)
// =====================================
// Tells express to host the 'frontend' folder
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/menu', require('./routes/menu.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/tables', require('./routes/table.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/settings', require('./routes/settings.routes'));

// Catch-all Fallback (Redirects unknown routes back to Login/Index Page)
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start Server using http.server (important for socket.io)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});