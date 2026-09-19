# 🍕 Perfect Pizza POS & Café Management System

A complete Web-based Point of Sale (POS), Billing, Inventory, and Café Management system tailored for Perfect Pizza Café.

## 🚀 Features

- **Billing & POS**: Fast order processing for Delivery, Takeaway, and Dine-in (4 Tables).
- **Multi-Branch Support**: Scalable architecture for multiple café locations.
- **Smart Menu**: Sizes (Regular/Medium/Large), Crusts (Cheese Burst, Thin), Add-ons, and Combos.
- **Auto Delivery Charges**: Distance-based delivery charge calculation (0-5 km).
- **GST Management**: Admin toggleable 5% GST per bill.
- **Rewards System**: Earn coins on orders > ₹100, redeem on next visits.
- **Kitchen Display System (KDS)**: Real-time order sync with beep alerts using Socket.io.
- **Inventory Tracking**: Manage stock, purchases, consumption, and wastage.
- **WhatsApp Integration**: Instant bill sharing via `wa.me` links.
- **Offline Support (PWA)**: Works offline using Service Workers and IndexedDB.

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (PWA enabled)
- **Backend**: Node.js, Express.js, Socket.io
- **Database**: MongoDB Atlas (Cloud)
- **Hosting**: Render (Backend) / Netlify (Frontend)

## 📁 Folder Structure

\`\`\`
perfect-pizza-pos/
├── backend/       # Node.js + Express API
└── frontend/      # UI, CSS, Vanilla JS
\`\`\`

## ⚙️ Environment Variables (.env)

Create a `.env` file in the `backend/` directory with the following variables:

\`\`\`env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/perfectpizza?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_key_here
NODE_ENV=development
\`\`\`

## 🚀 Quick Start (Development)

1. **Clone & Install Backend**
   \`\`\`bash
   cd backend
   npm install
   npm run dev
   \`\`\`
2. **Run Frontend**
   Use VS Code extension **"Live Server"** to open `frontend/index.html`.

## 👨‍💻 Roles & Permissions
- **Super Admin (Owner)**: Full access, settings, branches, edit GST.
- **Admin (Manager)**: Branch specific full access.
- **Cashier**: POS billing, view orders, customers.
- **Kitchen Staff**: Kitchen Display Screen only.

---
*Built for Perfect Pizza Café - 100% Pure Mozzarella's Pizza* 🍕