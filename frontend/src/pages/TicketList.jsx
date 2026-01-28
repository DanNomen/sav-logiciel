import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaPlus, FaTicketAlt, FaClock, FaUser, FaCircle,
    FaExclamationCircle, FaEdit, FaTrashAlt, FaPhone, FaLink, FaInfoCircle, FaTimes
} from "react-icons/fa";
import "./TicketList.css";

function TicketList() {
    const [tickets, setTickets] = useState([]);
    const [clients, setClients] = useState({});
    const [allInterventions, setAllInterventions] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const filteredTickets = user.role === "ADMIN"
        ? tickets
        : tickets.filter(t => t.assigned_to === user.full_name);

    useEffect(() => {
        fetchTickets();
        fetchClients();
        fetchInterventions();
    }, []);

    const fetchTickets = async () => {
        try {
            const response = await fetch("http://localhost:8000/api/tickets");
            if (response.ok) {
                const data = await response.json();
                setTickets(data);
            }
        } catch (error) {
            console.error("Error fetching tickets:", error);
        }
    };

    const fetchClients = async () => {
        try {
            const response = await fetch("http://localhost:8000/api/clients");
            if (response.ok) {
                const data = await response.json();
                const cliMap = {};
                data.forEach(c => cliMap[c.id] = c);
                setClients(cliMap);
            }
        } catch (error) {
            console.error("Error fetching clients:", error);
        }
    };

    const fetchInterventions = async () => {
        try {
            const response = await fetch("http://localhost:8000/api/interventions");
            if (response.ok) {
                const data = await response.json();
                setAllInterventions(data);
            }
        } catch (error) {
            console.error("Error fetching interventions:", error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Supprimer ce ticket ?")) {
            try {
                const response = await fetch(`http://localhost:8000/api/tickets/${id}`, {
                    method: 'DELETE',
                });
                if (response.ok) {
                    setTickets(tickets.filter(t => t.id !== id));
                }
            } catch (error) {
                console.error("Error deleting ticket:", error);
            }
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case "Urgente": return "#ef4444";
            case "Haute": return "#f59e0b";
            case "Normale": return "#3b82f6";
            case "Faible": return "#10b981";
            default: return "#94a3b8";
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "Ouvert": return "#3b82f6";
            case "En Attente": return "#f59e0b";
            case "Fermé": return "#10b981";
            default: return "#94a3b8";
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            const response = await fetch(`http://localhost:8000/api/tickets/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus } : t));
            }
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const StatusSelector = ({ id, currentStatus }) => {
        const statuses = ["Ouvert", "En Attente", "Fermé"];
        const color = getStatusColor(currentStatus);

        // Si le ticket est fermé, afficher un badge statique
        if (currentStatus === "Fermé") {
            return (
                <div className="ticket-status-pill-static" style={{ borderColor: color, color: color }}>
                    <FaCircle size={8} /> {currentStatus}
                </div>
            );
        }

        return (
            <div className="ticket-status-selector" style={{ borderColor: color, color: color }}>
                <FaCircle size={8} />
                <select
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(id, e.target.value)}
                    className="status-select-ticket"
                    style={{ color: color }}
                >
                    {statuses.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>
        );
    };

    return (
        <div className="ticket-list-container">
            <div className="ticket-list-header">
                <h1>Gestion des Tickets</h1>
                <button className="new-ticket-btn" onClick={() => navigate("/add-ticket")}>
                    <FaPlus /> Nouveau Ticket
                </button>
            </div>

            <div className="ticket-grid">
                {filteredTickets.length === 0 ? (
                    <div className="no-tickets">
                        <FaTicketAlt size={48} />
                        <p>{user.role === "ADMIN" ? "Aucun ticket ouvert." : "Aucun ticket assigné."}</p>
                    </div>
                ) : (
                    filteredTickets.map((ticket) => (
                        <div key={ticket.id} className="ticket-card">
                            <div className="priority-line" style={{ backgroundColor: getPriorityColor(ticket.priority) }}></div>

                            <div className="ticket-card-header">
                                <div>
                                    <div className="ticket-header-top">
                                        <StatusSelector id={ticket.id} currentStatus={ticket.status} />
                                        <div className="ticket-number-pill">#{ticket.ticket_number}</div>
                                    </div>
                                    <h3 title={ticket.subject}>{ticket.subject}</h3>
                                </div>
                                <div className="ticket-priority-tag" style={{ background: `${getPriorityColor(ticket.priority)}20`, color: getPriorityColor(ticket.priority) }}>
                                    {ticket.priority}
                                </div>
                            </div>

                            <div className="ticket-card-body">
                                <div className="ticket-info-row">
                                    <FaUser size={14} />
                                    <span>{clients[ticket.client_id]?.nom || "Client inconnu"}</span>
                                </div>
                                <div className="ticket-info-row">
                                    <FaClock size={14} />
                                    <span>Le: {ticket.request_date} | Limite: {ticket.deadline_date || "N/A"}</span>
                                </div>
                                <div className="ticket-info-row">
                                    <FaUser size={14} />
                                    <span>Assigné: {ticket.assigned_to || "Non assigné"}</span>
                                </div>
                                <p className="ticket-desc-short">{ticket.description}</p>
                            </div>

                            <div className="ticket-card-footer">
                                <button className="details-btn-text" onClick={() => { setSelectedTicket(ticket); setShowModal(true); }}>
                                    <FaInfoCircle size={14} /> Détails
                                </button>
                                {ticket.status !== "Fermé" && (
                                    <div className="action-actions">
                                        <button className="edit-btn-small" onClick={() => navigate("/add-ticket", { state: { ticket } })} title="Modifier">
                                            <FaEdit size={16} />
                                        </button>
                                        {user.role === "ADMIN" && (
                                            <button className="delete-btn-small" onClick={() => handleDelete(ticket.id)} title="Supprimer">
                                                <FaTrashAlt size={16} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showModal && selectedTicket && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content ticket-details-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <span className="modal-subtitle">Fiche détaillée</span>
                                <h2>Ticket #{selectedTicket.ticket_number}</h2>
                            </div>
                            <button className="close-modal" onClick={() => setShowModal(false)}>
                                <FaTimes size={20} />
                            </button>
                        </div>

                        <div className="modal-body ticket-details-body">
                            <div className="details-section">
                                <div className="status-priority-header">
                                    <span className="status-pill" style={{ borderColor: getStatusColor(selectedTicket.status), color: getStatusColor(selectedTicket.status) }}>
                                        {selectedTicket.status}
                                    </span>
                                    <span className="priority-pill" style={{ background: `${getPriorityColor(selectedTicket.priority)}20`, color: getPriorityColor(selectedTicket.priority) }}>
                                        Priorité: {selectedTicket.priority}
                                    </span>
                                </div>
                                <h3>{selectedTicket.subject}</h3>
                                <p className="description-text">{selectedTicket.description || "Pas de description détaillée."}</p>
                            </div>

                            <div className="details-grid">
                                <div className="detail-item">
                                    <label>Client</label>
                                    <span>{clients[selectedTicket.client_id]?.nom}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Demandeur</label>
                                    <span>{selectedTicket.requester}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Date demande</label>
                                    <span>{selectedTicket.request_date}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Date limite</label>
                                    <span>{selectedTicket.deadline_date || "N/A"}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Affecté à</label>
                                    <span>{selectedTicket.assigned_to || "Non assigné"}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Prochaine étape</label>
                                    <span>{selectedTicket.next_step || "N/A"}</span>
                                </div>
                                {selectedTicket.resolution_date && (
                                    <div className="detail-item">
                                        <label>Résolu le</label>
                                        <span>{selectedTicket.resolution_date}</span>
                                    </div>
                                )}
                            </div>

                            {selectedTicket.comment && (
                                <div className="comment-box">
                                    <label>Commentaire interne</label>
                                    <p>{selectedTicket.comment}</p>
                                </div>
                            )}

                            <div className="linked-interventions-section">
                                <h4>Interventions liées</h4>
                                {allInterventions.filter(i => i.ticket_id === selectedTicket.id).length === 0 ? (
                                    <p className="no-items-mini">Aucune intervention liée à ce ticket.</p>
                                ) : (
                                    <div className="mini-interventions-list">
                                        {allInterventions.filter(i => i.ticket_id === selectedTicket.id).map(i => (
                                            <div key={i.id} className="mini-int-card">
                                                <div className="mini-int-header">
                                                    <span className={`type-tag ${i.type}`}>{i.type === 'preventive' ? 'IP' : 'IC'}</span>
                                                    <strong>{i.title}</strong>
                                                    <span className="int-date">{i.date}</span>
                                                </div>
                                                <p className="int-summary">{i.type === 'preventive' ? i.observation : (i.context || i.resolution)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TicketList;
