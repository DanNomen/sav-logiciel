import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaPlus,
    FaEdit,
    FaTrashAlt,
    FaUser,
    FaPhone,
    FaEnvelope,
    FaMapMarkerAlt,
    FaInfoCircle,
    FaTimes,
    FaWrench,
    FaFileAlt,
    FaHashtag,
    FaCogs,
    FaShieldAlt,
    FaExclamationTriangle,
    FaTools,
    FaSearch,
    FaFilter
} from "react-icons/fa";
import API_BASE_URL from "../api_config";
import "./ClientList.css";

function ClientList() {
    const [clients, setClients] = useState([]);
    const [systems, setSystems] = useState([]);
    const [interventions, setInterventions] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const navigate = useNavigate();
    const userRole = JSON.parse(localStorage.getItem("user") || "{}").role;

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        console.log("DEBUG: Starting data fetch from", API_BASE_URL);

        // Fetch clients
        try {
            const res = await fetch(`${API_BASE_URL}/api/clients`);
            if (res.ok) {
                const data = await res.json();
                console.log("DEBUG: Clients received:", data);
                setClients(data);
            } else {
                console.error("DEBUG: API error on clients:", res.status);
            }
        } catch (e) { console.error("DEBUG: Network error on clients", e); }

        // Fetch systems (independently)
        try {
            const res = await fetch(`${API_BASE_URL}/api/systems`);
            if (res.ok) setSystems(await res.json());
        } catch (e) { console.error("DEBUG: Network error on systems", e); }

        // Fetch interventions (independently)
        try {
            const res = await fetch(`${API_BASE_URL}/api/interventions`);
            if (res.ok) setInterventions(await res.json());
        } catch (e) { console.error("DEBUG: Network error on interventions", e); }
    };

    const handleDelete = async (e, clientId) => {
        e.stopPropagation(); // Empêche l'ouverture du modal si on clique sur supprimer
        if (!clientId) return;
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setClients(clients.filter(c => c.id !== clientId));
                    if (selectedClient?.id === clientId) {
                        setIsModalOpen(false);
                        setSelectedClient(null);
                    }
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    alert(`Erreur lors de la suppression : ${errorData.detail || "Le serveur a refusé la demande."}`);
                }
            } catch (error) {
                console.error("Error deleting client:", error);
            }
        }
    };

    const handleEdit = (e, client) => {
        e.stopPropagation();
        navigate("/add-client", { state: { client } });
    };

    const openDetails = (client) => {
        setSelectedClient(client);
        setIsModalOpen(true);
    };

    const closeDetails = () => {
        setIsModalOpen(false);
        setSelectedClient(null);
    };

    const filteredClients = clients.filter(c => {
        const matchesSearch =
            (c.nom || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.client || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.telephone || "").toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = filterCategory === "all" || c.categorie === filterCategory;

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="client-list-container">
            <div className="client-list-header">
                <div className="header-title-section">
                    <h1>Liste des Clients</h1>
                    <span className="client-count">{filteredClients.length} client(s)</span>
                </div>

                <div className="header-actions">
                    <div className="search-filter-container">
                        <div className="search-wrapper">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Rechercher un client ou code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="filter-wrapper">
                            <FaFilter className="filter-icon" />
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                            >
                                <option value="all">Toutes catégories</option>
                                <option value="petrolier">Pétrolier</option>
                                <option value="ong">ONG</option>
                                <option value="bailleur">Bailleur</option>
                                <option value="societe">Société</option>
                                <option value="particulier">Particulier</option>
                            </select>
                        </div>
                    </div>
                    <button className="new-client-btn" onClick={() => navigate("/add-client")}>
                        <FaPlus size={20} /> Nouveau Client
                    </button>
                </div>
            </div>

            <div className="client-grid">
                {filteredClients.length === 0 ? (
                    <div className="no-clients-message">
                        <FaUser size={48} />
                        <p>{searchTerm || filterCategory !== 'all' ? "Aucun client ne correspond à votre recherche." : "Aucun client trouvé."}</p>
                    </div>
                ) : (
                    filteredClients.map((client) => (
                        <div key={client.id || client.nom} className="client-card animate-fadeIn">
                            <div className="card-badge">{client.categorie}</div>
                            <div className="card-header">
                                <div className="client-basic-info">
                                    <h3>{client.nom}</h3>
                                    {client.client && <div className="client-subtitle">{client.client}</div>}
                                    <span className="client-phone">
                                        <FaPhone size={14} /> {client.telephone}
                                    </span>
                                </div>
                            </div>

                            <div className="card-body">
                                <div className="info-row">
                                    <FaMapMarkerAlt size={16} />
                                    <span>{client.localisation || "Non spécifiée"}</span>
                                </div>
                                <div className="info-row">
                                    <FaEnvelope size={16} />
                                    <span>{client.email || "Pas d'email"}</span>
                                </div>
                                <div className="info-row systems-count-row"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/systems?clientId=${client.id}`); }}
                                    style={{ cursor: 'pointer' }}
                                    title="Voir les systèmes de ce client"
                                >
                                    <FaCogs size={16} />
                                    <span className="systems-count-badge">
                                        {systems.filter(s => s.client_id === client.id).length} système(s) installé(s)
                                    </span>
                                </div>
                                <div className="info-row interventions-count-row"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/interventions?clientId=${client.id}`); }}
                                    style={{ cursor: 'pointer' }}
                                    title="Voir les interventions de ce client"
                                >
                                    <FaTools size={16} />
                                    <span className="interventions-count-badge">
                                        {interventions.filter(i => i.client_id === client.id).length} intervention(s)
                                    </span>
                                </div>
                            </div>

                            <div className="card-footer">
                                <div className="footer-main-btns">
                                    <button className="details-btn" onClick={() => openDetails(client)}>
                                        <FaInfoCircle size={16} /> Détails
                                    </button>
                                    <button className="system-btn" onClick={(e) => { e.stopPropagation(); navigate("/add-system", { state: { clientId: client.id } }); }}>
                                        <FaCogs size={16} /> Ajouter système
                                    </button>
                                    <button className="intervention-btn preventive" onClick={(e) => { e.stopPropagation(); navigate("/add-intervention", { state: { clientId: client.id, type: "preventive" } }); }}>
                                        <FaShieldAlt size={16} /> IP
                                    </button>
                                    <button className="intervention-btn corrective" onClick={(e) => { e.stopPropagation(); navigate("/add-intervention", { state: { clientId: client.id, type: "corrective" } }); }}>
                                        <FaExclamationTriangle size={16} /> IC
                                    </button>
                                </div>
                                <div className="action-actions">
                                    <button className="edit-btn-small" onClick={(e) => handleEdit(e, client)} title="Modifier">
                                        <FaEdit size={16} />
                                    </button>
                                    {userRole === "ADMIN" && (
                                        <button className="delete-btn-small" onClick={(e) => handleDelete(e, client.id)} title="Supprimer">
                                            <FaTrashAlt size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal de détail */}
            {isModalOpen && selectedClient && (
                <div className="modal-overlay" onClick={closeDetails}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Informations Client</h2>
                            <button className="close-btn" onClick={closeDetails}>
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="detail-section">
                                <h3><FaUser size={20} /> Identité</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Nom complet</label>
                                        <p>{selectedClient.nom}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Code Client</label>
                                        <p>{selectedClient.client || "N/A"}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Catégorie</label>
                                        <p><span className="category-pill">{selectedClient.categorie}</span></p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Créé par</label>
                                        <p>{selectedClient.created_by || "Système"} le {selectedClient.created_at || "N/A"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3><FaPhone size={20} /> Contact & Localisation</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Téléphone</label>
                                        <p>{selectedClient.telephone}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Email</label>
                                        <p>{selectedClient.email || "Non renseigné"}</p>
                                    </div>
                                    <div className="detail-item full-width">
                                        <label>Localisation</label>
                                        <p>{selectedClient.localisation || "Non renseignée"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3><FaWrench size={20} /> Informations Techniques</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Technicien</label>
                                        <p>{selectedClient.technicien || "Non assigné"}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Nombre de systèmes</label>
                                        <p>
                                            <span
                                                className="systems-pill"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => navigate(`/systems?clientId=${selectedClient.id}`)}
                                                title="Voir les systèmes"
                                            >
                                                {systems.filter(s => s.client_id === selectedClient.id).length}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3><FaFileAlt size={20} /> Historique des modifications</h3>
                                {selectedClient.history && selectedClient.history.length > 0 ? (
                                    <div className="history-timeline">
                                        {selectedClient.history.map((h, index) => (
                                            <div key={index} className="history-event">
                                                <div className="event-marker"></div>
                                                <div className="event-content">
                                                    <span className="event-action">{h.action}</span>
                                                    <span className="event-meta">Par <strong>{h.user}</strong> le {h.date}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="no-history">Aucun historique disponible pour ce client.</p>
                                )}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="modal-edit-btn" onClick={(e) => { handleEdit(e, selectedClient); closeDetails(); }}>
                                <FaEdit size={18} /> Modifier le client
                            </button>
                            <button className="modal-close-btn" onClick={closeDetails}>
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClientList;
