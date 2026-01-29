import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaPlus, FaEdit, FaTrashAlt, FaCogs, FaUser, FaTools, FaFilter, FaTimes, FaInfoCircle, FaFileAlt, FaSync } from "react-icons/fa";
import "./SystemList.css";

function SystemList() {
    const [systems, setSystems] = useState([]);
    const [clients, setClients] = useState({});
    const [selectedSystem, setSelectedSystem] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const clientIdFilter = searchParams.get("clientId");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [sysRes, cliRes] = await Promise.all([
                fetch("http://localhost:8000/api/systems"),
                fetch("http://localhost:8000/api/clients")
            ]);

            if (sysRes.ok && cliRes.ok) {
                const sysData = await sysRes.json();
                const cliData = await cliRes.json();

                const cliMap = {};
                cliData.forEach(c => cliMap[c.id] = c);

                setSystems(sysData);
                setClients(cliMap);
            }
        } catch (error) {
            console.error("Error fetching systems/clients:", error);
        }
    };

    const handleSyncVRM = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch("http://localhost:8000/api/systems/sync", {
                method: "POST"
            });
            if (response.ok) {
                const data = await response.json();
                alert(data.message);
                fetchData(); // Refresh list to show new systems
            } else {
                alert("Erreur lors de la synchronisation VRM.");
            }
        } catch (error) {
            console.error("Sync error:", error);
            alert("Erreur de connexion au serveur.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Supprimer ce système ?")) {
            try {
                const response = await fetch(`http://localhost:8000/api/systems/${id}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setSystems(systems.filter(s => s.id !== id));
                }
            } catch (error) {
                console.error("Error deleting system:", error);
            }
        }
    };

    const handleEdit = (system) => {
        navigate("/add-system", { state: { system } });
    };

    const filteredSystems = clientIdFilter
        ? systems.filter(s => s.client_id === clientIdFilter)
        : systems;

    const clearFilter = () => {
        setSearchParams({});
    };

    const openDetails = (system) => {
        setSelectedSystem(system);
        setIsModalOpen(true);
    };

    const closeDetails = () => {
        setIsModalOpen(false);
        setSelectedSystem(null);
    };

    return (
        <div className="system-list-container">
            <div className="system-list-header">
                <div className="header-title-area">
                    <h1>Liste des Systèmes</h1>
                    {clientIdFilter && (
                        <div className="filter-badge">
                            <FaFilter size={12} />
                            <span>Client: {clients[clientIdFilter]?.nom || "..."}</span>
                            <button className="clear-filter-btn" onClick={clearFilter} title="Effacer le filtre">
                                <FaTimes size={12} />
                            </button>
                        </div>
                    )}
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="new-system-btn"
                        onClick={handleSyncVRM}
                        style={{ background: isSyncing ? '#4b5563' : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}
                        disabled={isSyncing}
                    >
                        <FaSync size={20} className={isSyncing ? "fa-spin" : ""} />
                        {isSyncing ? "Synchronisation..." : "Synchroniser VRM"}
                    </button>
                    <button className="new-system-btn" onClick={() => navigate("/add-system")}>
                        <FaPlus size={20} /> Nouveau Système
                    </button>
                </div>
            </div>

            <div className="system-grid">
                {filteredSystems.length === 0 ? (
                    <div className="no-systems-message">
                        <FaCogs size={48} />
                        <p>{clientIdFilter ? "Aucun système pour ce client." : "Aucun système enregistré."}</p>
                    </div>
                ) : (
                    filteredSystems.map((system) => (
                        <div key={system.id} className="system-card">
                            <div className="system-card-badge">{system.installation_type}</div>
                            <div className="system-card-header">
                                <div className="system-icon-bg">
                                    <FaCogs size={24} />
                                </div>
                                <div className="system-info">
                                    <h3>{system.monitoring_name}</h3>
                                    <span className="system-client-name">
                                        <FaUser size={12} /> {clients[system.client_id]?.nom || "Client inconnu"}
                                    </span>
                                </div>
                            </div>

                            <div className="system-card-body">
                                <div className="system-data-row">
                                    <label>Puissance:</label>
                                    <span>{system.power_va} VA</span>
                                </div>
                                <div className="system-data-row">
                                    <label>Agence:</label>
                                    <span>{system.agency}</span>
                                </div>
                                <div className="system-data-row">
                                    <label>Ingénieur:</label>
                                    <span>{system.engineer}</span>
                                </div>
                            </div>

                            <div className="system-card-footer">
                                <button className="details-btn" onClick={() => openDetails(system)}>
                                    <FaInfoCircle size={16} /> Détails
                                </button>
                                <button className="edit-btn" onClick={() => handleEdit(system)}>
                                    <FaEdit size={16} /> Modifier
                                </button>
                                <button className="delete-btn" onClick={() => handleDelete(system.id)}>
                                    <FaTrashAlt size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal de détails système */}
            {isModalOpen && selectedSystem && (
                <div className="modal-overlay" onClick={closeDetails}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Détails du Système</h2>
                            <button className="close-btn" onClick={closeDetails}>
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="detail-section">
                                <h3><FaCogs size={20} /> Informations Générales</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Nom du monitoring</label>
                                        <p>{selectedSystem.monitoring_name}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Client</label>
                                        <p>{clients[selectedSystem.client_id]?.nom || "Client inconnu"}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Type d'installation</label>
                                        <p><span className="category-pill">{selectedSystem.installation_type}</span></p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Puissance (VA)</label>
                                        <p>{selectedSystem.power_va} VA</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Date de mise en service</label>
                                        <p>{selectedSystem.commissioning_date || "N/A"}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Agence</label>
                                        <p>{selectedSystem.agency}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Ingénieur</label>
                                        <p>{selectedSystem.engineer}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Victron Site ID</label>
                                        <p>{selectedSystem.victron_site_id || "N/A"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3><FaTools size={20} /> Composants Techniques</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Panneaux PV</label>
                                        <p>{selectedSystem.pv_type || "N/A"} ({selectedSystem.pv_count || 0})</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Inverter / Charger</label>
                                        <p>{selectedSystem.inverter_charger_type || "N/A"} ({selectedSystem.inverter_charger_count || 0})</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Onduleur PV</label>
                                        <p>{selectedSystem.pv_inverter_type || "N/A"} ({selectedSystem.pv_inverter_count || 0})</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Batteries</label>
                                        <p>{selectedSystem.battery_type || "N/A"} ({selectedSystem.battery_count || 0})</p>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3><FaUser size={20} /> Contact Site</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Technicien Site</label>
                                        <p>{selectedSystem.site_technician_name || "N/A"}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Téléphone Technicien</label>
                                        <p>{selectedSystem.site_technician_phone || "N/A"}</p>
                                    </div>
                                    <div className="detail-item full-width">
                                        <label>Localisation exacte</label>
                                        <p>{selectedSystem.location || "N/A"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h3><FaFileAlt size={20} /> Contrat & Commentaires</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Type de contrat</label>
                                        <p>{selectedSystem.contract_type}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Durée du contrat (mois)</label>
                                        <p>{selectedSystem.contract_duration_months} mois</p>
                                    </div>
                                    <div className="detail-item full-width">
                                        <label>Commentaires</label>
                                        <p style={{ whiteSpace: 'pre-wrap' }}>{selectedSystem.comments || "Aucun commentaire."}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="modal-edit-btn" onClick={() => { handleEdit(selectedSystem); closeDetails(); }}>
                                <FaEdit size={18} /> Modifier le système
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

export default SystemList;
