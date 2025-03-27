

const express = require("express");
const mysql = require("mysql2");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors()); // ✅ Fix CORS issue

// MySQL Connection

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "itinerary@123",
    database: "itineraryDB",
  });



app.use(cors({
    origin: ["https://itinerary-ai.vercel.app","https://itinerary-backend-khaki.vercel.app", "https://itinerary-backend-khaki.vercel.app/create-itinerary","https://itinerary-backend-khaki.vercel.app/itinerary"], // Add allowed origins
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed methods
    allowedHeaders: ["Content-Type", "Authorization"] // Allowed headers
  }));

db.connect((err) => {
  if (err) console.error("❌ Database connection failed:", err);
  else console.log("✅ Connected to MySQL Database");
});

// 📌 Create Itinerary
app.post("/create-itinerary", (req, res) => {
  const {
    tripName,
    destination,
    duration,
    focus,
    people,
    country,
    staynight,
    days,
    notes,
    Hotels,
    policies,
    destinationImage,
  } = req.body;

  console.log(staynight)

  const shareableLink = uuidv4();

  const itineraryQuery = `
    INSERT INTO itineraries (shareableLink, tripName, destination, duration, focus, people, country, staynight, days, notes, destinationImage) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(
    itineraryQuery,
    [
      shareableLink,
      tripName,
      destination,
      duration,
      focus,
      people,
      country,
      JSON.stringify(staynight),
      JSON.stringify(days),
      notes,
      JSON.stringify(destinationImage),
    ],
    (err, result) => {
      if (err)
        return res
          .status(500)
          .json({ message: "❌ Error creating itinerary", error: err });

      const itineraryId = result.insertId;

      // ✅ Insert Hotels
      if (Hotels?.length) {
        const hotelQuery = `INSERT INTO hotels (itinerary_id, name, dates, rating, content, location, imageUrl) VALUES ?`;
        const hotelValues = Hotels.map(({ name, dates, rating, content, location, imageUrl }) => [
          itineraryId,
          name,
          dates,
          rating,
          content,
          location,
          imageUrl,
        ]);

        db.query(hotelQuery, [hotelValues], (err) => {
          if (err) console.error("❌ Error inserting hotels:", err);
        });
      }

      // ✅ Insert Policies
      if (policies?.length) {
        const policyQuery = `INSERT INTO policies (itinerary_id, heading, paragraph) VALUES ?`;
        const policyValues = policies.map(({ heading, paragraph }) => [itineraryId, heading, paragraph]);

        db.query(policyQuery, [policyValues], (err) => {
          if (err) console.error("❌ Error inserting policies:", err);
        });
      }

      res.json({
        message: "✅ Itinerary created",
        shareableLink: `https://itinerary-ai.vercel.app/template/${shareableLink}`,
      });
    }
  );
});

// 📌 Get Itinerary by Shareable Link
app.get("/itinerary/:shareableLink", (req, res) => {
  const { shareableLink } = req.params;

  db.query(`SELECT * FROM itineraries WHERE shareableLink = ?`, [shareableLink], (err, results) => {
    if (err) return res.status(500).json({ message: "❌ Error fetching itinerary", error: err });
    if (!results.length) return res.status(404).json({ message: "❌ Itinerary not found" });

    const itinerary = results[0];

    db.query(`SELECT name, dates, rating, content, location, imageUrl FROM hotels WHERE itinerary_id = ?`, [itinerary.id], (err, hotelResults) => {
      if (err) return res.status(500).json({ message: "❌ Error fetching hotels", error: err });

      db.query(`SELECT heading, paragraph FROM policies WHERE itinerary_id = ?`, [itinerary.id], (err, policyResults) => {
        if (err) return res.status(500).json({ message: "❌ Error fetching policies", error: err });

        // ✅ Convert JSON fields
        const staynight = typeof itinerary.staynight === "string" ? JSON.parse(itinerary.staynight) : itinerary.staynight;
       
        const days = typeof itinerary.days === "string" ? JSON.parse(itinerary.days) : itinerary.days;
        const destinationImage =
          typeof itinerary.destinationImage === "string"
            ? JSON.parse(itinerary.destinationImage)
            : itinerary.destinationImage;

        res.json({
          ...itinerary,
          shareableLink: `https://itinerary-ai.vercel.app/template/${shareableLink}`,
          hotels: hotelResults,
          policies: policyResults,
          staynight,
          days,
          destinationImage,
        });
      });
    });
  });
});

// 📌 Get All Itineraries
app.get("/itineraries", (req, res) => {
  db.query(`SELECT id, shareableLink, tripName, destination, duration FROM itineraries`, (err, results) => {
    if (err) return res.status(500).json({ message: "❌ Error fetching itineraries" });
    res.json(results);
  });
});

// 📌 Update Itinerary
app.put("/update-itinerary/:shareableLink", (req, res) => {
  const { shareableLink } = req.params;
  const { tripName, destination, duration, focus, people, country, staynight, days, notes, destinationImage } = req.body;

  db.query(
    `UPDATE itineraries SET tripName = ?, destination = ?, duration = ?, focus = ?, people = ?, country = ?, staynight = ?, days = ?, notes = ?, destinationImage = ? WHERE shareableLink = ?`,
    [tripName, destination, duration, focus, people, country, JSON.stringify(staynight), JSON.stringify(days), notes, JSON.stringify(destinationImage), shareableLink],
    (err, result) => {
      if (err) return res.status(500).json({ message: "❌ Error updating itinerary" });
      if (!result.affectedRows) return res.status(404).json({ message: "❌ Itinerary not found" });

      res.json({ message: "✅ Itinerary updated successfully" });
    }
  );
});

// 📌 Delete Itinerary
app.delete("/itinerary/:shareableLink", (req, res) => {
  db.query(`DELETE FROM itineraries WHERE shareableLink = ?`, [req.params.shareableLink], (err, result) => {
    if (err) return res.status(500).json({ message: "❌ Error deleting itinerary" });
    if (!result.affectedRows) return res.status(404).json({ message: "❌ Itinerary not found" });

    res.json({ message: "✅ Itinerary deleted successfully" });
  });
});

// ✅ Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
