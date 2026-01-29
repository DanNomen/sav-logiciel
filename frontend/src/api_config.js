// Détection automatique : si localhost on utilise le port 8000, sinon on utilise le serveur actuel
const API_BASE_URL = window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "";

export default API_BASE_URL;