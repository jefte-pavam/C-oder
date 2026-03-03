import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("caoder.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT, -- 'DONOR', 'ADOPTER'
    avatar TEXT,
    emoji TEXT,
    bio TEXT
  );

  CREATE TABLE IF NOT EXISTS dogs (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    name TEXT,
    breed TEXT,
    age TEXT,
    photos TEXT, -- JSON array
    behavior TEXT, -- JSON object
    bio TEXT,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    adopter_id TEXT,
    dog_id TEXT,
    status TEXT, -- 'PENDING', 'ACCEPTED', 'REJECTED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(adopter_id) REFERENCES users(id),
    FOREIGN KEY(dog_id) REFERENCES dogs(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT,
    sender_id TEXT,
    content TEXT,
    type TEXT, -- 'text', 'audio', 'video_call_request'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(match_id) REFERENCES matches(id)
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json({ limit: '50mb' }));

  // Auth Mock (Simple for demo)
  app.post("/api/auth/login", (req, res) => {
    const { email } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "User not found" });
    }
  });

  app.post("/api/auth/register", (req, res) => {
    const { id, name, email, role, avatar, emoji } = req.body;
    try {
      db.prepare("INSERT INTO users (id, name, email, role, avatar, emoji) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, name, email, role, avatar, emoji);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      res.json(user);
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  // Dogs
  app.get("/api/dogs", (req, res) => {
    const dogs = db.prepare(`
      SELECT dogs.*, users.name as owner_name 
      FROM dogs 
      JOIN users ON dogs.owner_id = users.id
    `).all();
    res.json(dogs.map(d => ({ ...d, photos: JSON.parse(d.photos || '[]'), behavior: JSON.parse(d.behavior || '{}') })));
  });

  app.post("/api/dogs", (req, res) => {
    const { id, owner_id, name, breed, age, photos, behavior, bio } = req.body;
    db.prepare("INSERT INTO dogs (id, owner_id, name, breed, age, photos, behavior, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, owner_id, name, breed, age, JSON.stringify(photos), JSON.stringify(behavior), bio);
    res.json({ success: true });
  });

  // Swiping
  app.post("/api/swipe", (req, res) => {
    const { adopter_id, dog_id, direction } = req.body;
    if (direction === 'right') {
      const id = `${adopter_id}_${dog_id}`;
      db.prepare("INSERT OR IGNORE INTO matches (id, adopter_id, dog_id, status) VALUES (?, ?, ?, ?)")
        .run(id, adopter_id, dog_id, 'ACCEPTED');
      res.json({ match: true, id });
    } else {
      res.json({ match: false });
    }
  });

  app.get("/api/matches/:userId", (req, res) => {
    const matches = db.prepare(`
      SELECT matches.*, dogs.name as dog_name, dogs.photos as dog_photos, users.name as owner_name
      FROM matches
      JOIN dogs ON matches.dog_id = dogs.id
      JOIN users ON dogs.owner_id = users.id
      WHERE matches.adopter_id = ?
    `).all(req.params.userId);
    res.json(matches.map(m => ({ ...m, dog_photos: JSON.parse(m.dog_photos || '[]') })));
  });

  // Socket.io for Real-time Chat
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_room", (matchId) => {
      socket.join(matchId);
    });

    socket.on("send_message", (data) => {
      const { match_id, sender_id, content, type } = data;
      db.prepare("INSERT INTO messages (match_id, sender_id, content, type) VALUES (?, ?, ?, ?)")
        .run(match_id, sender_id, content, type || 'text');
      io.to(match_id).emit("receive_message", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  // Admin Stats
  app.get("/api/admin/stats", (req, res) => {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const totalDogs = db.prepare("SELECT COUNT(*) as count FROM dogs").get().count;
    const totalMatches = db.prepare("SELECT COUNT(*) as count FROM matches").get().count;
    
    const breedRanking = db.prepare(`
      SELECT dogs.breed, COUNT(*) as count 
      FROM matches 
      JOIN dogs ON matches.dog_id = dogs.id 
      GROUP BY dogs.breed 
      ORDER BY count DESC 
      LIMIT 5
    `).all();

    const roleDistribution = db.prepare(`
      SELECT role, COUNT(*) as count FROM users GROUP BY role
    `).all();

    res.json({
      totalUsers,
      totalDogs,
      totalMatches,
      breedRanking,
      roleDistribution,
      usageStats: {
        avgSessionTime: "12 min",
        activeToday: Math.floor(totalUsers * 0.4)
      }
    });
  });

  app.post("/api/auth/admin", (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin') {
      res.json({ id: 'admin', name: 'Administrador', role: 'ADMIN', emoji: '🛡️' });
    } else {
      res.status(401).json({ error: "Credenciais inválidas" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(3000, "0.0.0.0", () => {
    console.log("Server running on http://localhost:3000");
  });
}

startServer();
