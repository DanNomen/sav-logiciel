// server.js
import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Stockage temporaire (en mémoire)
let clients = [];

// POST ajouter client
app.post("/api/clients", upload.single("contrat"), (req, res) => {
  const client = { ...req.body, contrat: req.file?.filename || null };
  clients.push(client);
  res.json({ message: "Client ajouté !", client });
});

// GET tous les clients
app.get("/api/clients", (req, res) => {
  res.json(clients);
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
