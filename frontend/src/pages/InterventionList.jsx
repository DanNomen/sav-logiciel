import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaPlus, FaTools, FaShieldAlt, FaExclamationTriangle, FaCalendarAlt, FaUser, FaTrashAlt, FaEdit, FaFilter, FaTimes, FaInfoCircle } from "react-icons/fa";
import "./InterventionList.css";

function InterventionList() {
    const [interventions, setInterventions] = useState([]);
    const [clients, setClients] = useState({});
    const [systems, setSystems] = useState({});
    const [tickets, setTickets] = useState({});
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedIntervention, setSelectedIntervention] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    const clientIdFilter = searchParams.get("clientId");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [intRes, cliRes, sysRes, tickRes] = await Promise.all([
                fetch("http://localhost:8000/api/interventions"),
                fetch("http://localhost:8000/api/clients"),
                fetch("http://localhost:8000/api/systems"),
                fetch("http://localhost:8000/api/tickets")
            ]);

            if (intRes.ok && cliRes.ok && sysRes.ok && tickRes.ok) {
                const intData = await intRes.json();
                const cliData = await cliRes.json();
                const sysData = await sysRes.json();
                const tickData = await tickRes.json();

                const cliMap = {};
                cliData.forEach(c => cliMap[c.id] = c);

                const sysMap = {};
                sysData.forEach(s => sysMap[s.id] = s);

                const tickMap = {};
                tickData.forEach(t => tickMap[t.id] = t);

                setInterventions(intData);
                setClients(cliMap);
                setSystems(sysMap);
                setTickets(tickMap);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Supprimer cette intervention ?")) {
            try {
                const response = await fetch(`http://localhost:8000/api/interventions/${id}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setInterventions(interventions.filter(i => i.id !== id));
                }
            } catch (error) {
                console.error("Error deleting intervention:", error);
            }
        }
    };

    const filteredInterventions = clientIdFilter
        ? interventions.filter(i => i.client_id === clientIdFilter)
        : interventions;

    const clearFilter = () => {
        setSearchParams({});
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            const response = await fetch(`http://localhost:8000/api/interventions/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                setInterventions(interventions.map(i => i.id === id ? { ...i, status: newStatus } : i));
            }
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const StatusSelector = ({ id, currentStatus }) => {
        const statuses = ["NOUVEAU", "EN COURS", "TERMINÉ", "EN ATTENTE", "ANNULÉ"];

        // Si l'intervention est terminée, afficher un badge statique
        if (currentStatus === "TERMINÉ") {
            return (
                <div className={`status-badge-static status-${currentStatus.replace(/\s+/g, '-').toLowerCase()}`}>
                    {currentStatus}
                </div>
            );
        }

        return (
            <div className={`status-badge-container status-${currentStatus.replace(/\s+/g, '-').toLowerCase()}`}>
                <select
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(id, e.target.value)}
                    className="status-select"
                >
                    {statuses.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>
        );
    };

    return (
        <div className="intervention-list-container">
            <div className="intervention-list-header">
                <div className="header-title-area">
                    <h1>Historique des Interventions</h1>
                    {clientIdFilter && (
                        <div className="filter-badge">
                            <FaFilter size={12} />
                            <span>Client: {clients[clientIdFilter]?.nom || "..."}</span>
                            <button className="clear-filter-btn" onClick={clearFilter}>
                                <FaTimes size={12} />
                            </button>
                        </div>
                    )}
                </div>
                <div className="header-actions">
                    <button className="new-btn preventive" onClick={() => navigate("/add-intervention", { state: { type: "preventive" } })}>
                        <FaShieldAlt /> Préventive
                    </button>
                    <button className="new-btn corrective" onClick={() => navigate("/add-intervention", { state: { type: "corrective" } })}>
                        <FaExclamationTriangle /> Corrective
                    </button>
                </div>
            </div>

            <div className="intervention-grid">
                {filteredInterventions.length === 0 ? (
                    <div className="no-items">
                        <FaTools size={48} />
                        <p>{clientIdFilter ? "Aucune intervention pour ce client." : "Aucune intervention enregistrée."}</p>
                    </div>
                ) : (
                    filteredInterventions.map((item) => (
                        <div key={item.id} className={`intervention-card ${item.type}`}>
                            <StatusSelector id={item.id} currentStatus={item.status} />

                            <div className="card-header">
                                <div className="type-icon-bg">
                                    {item.type === "preventive" ? <FaShieldAlt size={22} /> : <FaExclamationTriangle size={22} />}
                                </div>
                                <div className="header-info">
                                    <h3 title={item.title}>{item.title}</h3>
                                    <div className="client-subtitle">
                                        <FaUser size={12} /> {clients[item.client_id]?.nom || "Client inconnu"}
                                    </div>
                                </div>
                            </div>

                            <div className="card-body">
                                <div className="info-row">
                                    <FaTools size={14} />
                                    <span>Système: {systems[item.system_id]?.monitoring_name || "Inconnu"}</span>
                                </div>
                                <div className="info-row">
                                    <FaCalendarAlt size={14} />
                                    <span>Date: {item.date}</span>
                                </div>
                                <div className="info-row">
                                    <FaUser size={14} />
                                    <span>Tech: {item.technician || item.technicien || "Non spécifié"}</span>
                                </div>
                                {item.ticket_id && tickets[item.ticket_id] ? (
                                    <div className="info-row linked-ticket">
                                        <FaTools size={14} />
                                        <span>Ticket: #{tickets[item.ticket_id].ticket_number}</span>
                                    </div>
                                ) : (
                                    <div className="info-row hors-ticket">
                                        <span className="hors-ticket-badge">HORS TICKETS</span>
                                        {item.intervention_number && <span className="int-number-pill">{item.intervention_number}</span>}
                                    </div>
                                )}
                                <div className="summary-preview" title={item.type === "preventive" ? item.observation : item.context}>
                                    {item.type === "preventive" ? item.observation : item.context}
                                </div>
                            </div>

                            <div className="card-footer">
                                <button className="details-btn-text" onClick={() => { setSelectedIntervention(item); setIsModalOpen(true); }}>
                                    <FaInfoCircle size={14} /> Détails
                                </button>
                                {item.status !== "TERMINÉ" && (
                                    <div className="action-actions">
                                        <button className="edit-btn-small" onClick={() => navigate("/add-intervention", { state: { intervention: item } })} title="Modifier">
                                            <FaEdit size={16} />
                                        </button>
                                        <button className="delete-btn-small" onClick={() => handleDelete(item.id)} title="Supprimer">
                                            <FaTrashAlt size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal de détails intervention */}
            {isModalOpen && selectedIntervention && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Détails de l'Intervention</h2>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="detail-section">
                                <h3><FaTools size={20} /> Informations Générales</h3>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <label>Type</label>
                                        <p><span className={`type-badge ${selectedIntervention.type}`}>{selectedIntervention.type === 'preventive' ? 'Préventive' : 'Corrective'}</span></p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Statut</label>
                                        <p><span className={`status-pill status-${selectedIntervention.status.replace(/\s+/g, '-').toLowerCase()}`}>{selectedIntervention.status}</span></p>
                                    </div>
                                    <div className="detail-item full-width">
                                        <label>Titre</label>
                                        <p>{selectedIntervention.title}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Client</label>
                                        <p>{clients[selectedIntervention.client_id]?.nom || "Client inconnu"}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Système</label>
                                        <p>{systems[selectedIntervention.system_id]?.monitoring_name || "Inconnu"}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Technicien</label>
                                        <p>{selectedIntervention.technician || selectedIntervention.technicien || "Non spécifié"}</p>
                                    </div>
                                    <div className="detail-item">
                                        <label>Date</label>
                                        <p>{selectedIntervention.date}</p>
                                    </div>
                                    {selectedIntervention.intervention_number && (
                                        <div className="detail-item">
                                            <label>Numéro</label>
                                            <p>{selectedIntervention.intervention_number}</p>
                                        </div>
                                    )}
                                    {selectedIntervention.ticket_id && tickets[selectedIntervention.ticket_id] && (
                                        <div className="detail-item">
                                            <label>Ticket lié</label>
                                            <p>#{tickets[selectedIntervention.ticket_id].ticket_number}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedIntervention.type === 'preventive' ? (
                                <div className="detail-section">
                                    <h3>Observations</h3>
                                    <p className="detail-text">{selectedIntervention.observation || "Aucune observation."}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="detail-section">
                                        <h3>Contexte de la panne</h3>
                                        <p className="detail-text">{selectedIntervention.context || "N/A"}</p>
                                    </div>
                                    <div className="detail-section">
                                        <h3>Résolution</h3>
                                        <p className="detail-text">{selectedIntervention.resolution || "N/A"}</p>
                                    </div>
                                    {selectedIntervention.material_changed && (
                                        <div className="detail-section">
                                            <h3>Matériel remplacé</h3>
                                            <p className="detail-text">{selectedIntervention.material_changed}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="modal-footer">
                            {selectedIntervention.status !== "TERMINÉ" && (
                                <button className="modal-edit-btn" onClick={() => { navigate("/add-intervention", { state: { intervention: selectedIntervention } }); setIsModalOpen(false); }}>
                                    <FaEdit size={18} /> Modifier l'intervention
                                </button>
                            )}
                            <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InterventionList;
