const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const mysql = require("mysql2");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ============================
// 🧠 Database Connection
// ============================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",           // ⚠️ your MySQL username
  password: "root", // ⚠️ your MySQL password
  database: "digiskill_db"
});

db.connect(err => {
  if (err) {
    console.error("❌ MySQL Connection Error:", err);
  } else {
    console.log("✅ Connected to MySQL database");
  }
});

// ============================
// 🎟️ Constants
// ============================
const TOTAL_SEATS = 20;
const PRICING = {
  earlyBird: 2499,
  standard: 4499
};

const WORKSHOP = {
  name: "Digiskill Academy",
  startDate: "Saturday, November 15th, 2025",
  durationWeeks: 4,
  sessionDays: ["Saturday", "Sunday"],
  sessionTime: "7:00 PM - 8:30 PM (IST)",
  platform: "Live Online Sessions",
  requirements: "A computer with an internet connection. No prior marketing experience is needed."
};

// ============================
// 🧩 Helpers
// ============================
function getSeatsRemaining(callback) {
  db.query("SELECT COUNT(*) AS count FROM registrations", (err, results) => {
    if (err) return callback(err);
    const count = results[0].count;
    const remaining = Math.max(0, TOTAL_SEATS - count);
    callback(null, remaining);
  });
}

function currentPrice(seatsRemaining) {
  if (seatsRemaining > 10) return { label: "Early Bird Price", price: PRICING.earlyBird };
  if (seatsRemaining >= 1 && seatsRemaining <= 10) return { label: "Standard Price", price: PRICING.standard };
  return { label: "Sold Out", price: 0 };
}

// ============================
// 📡 Routes
// ============================

// Get workshop details with dynamic price & seats
app.get("/api/workshop", (req, res) => {
  getSeatsRemaining((err, seatsRemaining) => {
    if (err) return res.status(500).json({ error: "Database error" });
    const priceInfo = currentPrice(seatsRemaining);
    res.json({
      workshop: WORKSHOP,
      seatsRemaining,
      totalSeats: TOTAL_SEATS,
      priceLabel: priceInfo.label,
      price: priceInfo.price
    });
  });
});

// Register user or add to waitlist
app.post("/api/register", (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  getSeatsRemaining((err, seatsRemaining) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (seatsRemaining > 0) {
      // Seats available → register
      const registrationId = uuidv4();
      db.query(
        "INSERT INTO registrations (registration_id, name, email, timestamp) VALUES (?, ?, ?, NOW())",
        [registrationId, name, email],
        (err2) => {
          if (err2) {
            console.error("❌ Database Error (register):", err2);
            return res.status(500).json({ error: "Failed to register user" });
          }
          const priceInfo = currentPrice(seatsRemaining - 1);
          res.json({
            status: "registered",
            message: "Registration successful!",
            registrationId,
            seatsRemaining: seatsRemaining - 1,
            priceLabel: priceInfo.label,
            price: priceInfo.price
          });
        }
      );
    } else {
      // No seats left → add to waitlist
      db.query(
        "INSERT INTO waitlist (name, email, timestamp) VALUES (?, ?, NOW())",
        [name, email],
        (err3) => {
          if (err3) {
            console.error("❌ Database Error (waitlist):", err3);
            return res.status(500).json({ error: "Failed to add to waitlist" });
          }
          res.json({
            status: "waitlisted",
            message: "Workshop full. You’ve been added to the waitlist."
          });
        }
      );
    }
  });
});

// ============================
// 🚀 Start Server
// ============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
