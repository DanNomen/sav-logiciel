import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API_BASE_URL from "../api_config";
import "./AddTicket.css";

function AddTicket() {
    const navigate = useNavigate();
    const location = useLocation();
    const editData = location.state?.ticket;
    const initialClientId = location.state?.clientId || "";

    const [clients, setClients] = useState([]);
    const [interventions, setInterventions] = useState([]);
    const [formData, setFormData] = useState({
        ticket_number: "",
        subject: "",
        request_date: new Date().toISOString().split('T')[0],
        requester: "Client",
        priority: "Normale",
        client_id: initialClientId,
        assigned_to: "",
        description: "",
        status: "Ouvert",
        next_step: "",
        resolution_time: 0,
        comment: "",
        deadline_date: "",
        resolution_date: "",
        files: []
    });

    useEffect(() => {
        fetchClients();
        fetchInterventions();
        if (editData) {
            setFormData(editData);
        }
    }, [editData]);

    const fetchClients = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/clients`);
            if (response.ok) {
                const data = await response.json();
                setClients(data);
            }
        } catch (error) {
            console.error("Error fetching clients:", error);
        }
    };

    const fetchInterventions = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/interventions`);
            if (response.ok) {
                const data = await response.json();
                setInterventions(data);
            }
        } catch (error) {
            console.error("Error fetching interventions:", error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const isEdit = !!editData?.id;
            const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
            const userName = currentUser.full_name || "Inconnu";
            const userRole = currentUser.role || "TECHNICIEN";

            const baseUrl = isEdit
                ? `${API_BASE_URL}/api/tickets/${editData.id}`
                : `${API_BASE_URL}/api/tickets`;

            const url = `${baseUrl}?user_name=${encodeURIComponent(userName || "Inconnu")}&user_role=${encodeURIComponent(userRole || "TECHNICIEN")}`;
            const method = isEdit ? "PUT" : "POST";

            console.log("DEBUG: Sending ticket data:", formData);

            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert("Ticket enregistré !");
                navigate("/tickets");
            } else {
                alert("Erreur lors de l'enregistrement");
            }
        } catch (error) {
            console.error("Error saving ticket:", error);
            alert("Erreur serveur");
        }
    };

    return (
        <div className="add-ticket-container">
            <div className="add-ticket-card">
                <div className="add-ticket-header">
                    <h1 className="add-ticket-title">
                        {editData ? "Modifier le Ticket" : "Créer un Nouveau Ticket"}
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="add-ticket-form">
                    <div className="form-grid">
                        <label>
                            Numéro Ticket
                            <input type="text" name="ticket_number" value={formData.ticket_number} onChange={handleChange} required placeholder="ex: T-2024-001" />
                        </label>

                        <label className="full-width">
                            Motif de la demande
                            <input type="text" name="subject" value={formData.subject} onChange={handleChange} required placeholder="Sujet du ticket..." />
                        </label>

                        <label>
                            Date de la demande
                            <input type="date" name="request_date" value={formData.request_date} onChange={handleChange} required />
                        </label>

                        <label>
                            Demandeur
                            <select name="requester" value={formData.requester} onChange={handleChange} required>
                                <option value="Client">Client</option>
                                <option value="MGP">MGP</option>
                                <option value="Autres">Autres</option>
                            </select>
                        </label>

                        <label>
                            Priorité
                            <select name="priority" value={formData.priority} onChange={handleChange} required>
                                <option value="Urgente">Urgente</option>
                                <option value="Haute">Haute</option>
                                <option value="Normale">Normale</option>
                                <option value="Faible">Faible</option>
                            </select>
                        </label>

                        <label>
                            Client
                            <select name="client_id" value={formData.client_id} onChange={handleChange} required>
                                <option value="">Sélectionner un client</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.nom} ({c.client})</option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Affectation
                            <input type="text" name="assigned_to" value={formData.assigned_to} onChange={handleChange} placeholder="Nom du technicien/agent" />
                        </label>

                        <label>
                            Statut
                            <select name="status" value={formData.status} onChange={handleChange} required>
                                <option value="Ouvert">Ouvert</option>
                                <option value="En Attente">En Attente</option>
                                <option value="Fermé">Fermé</option>
                            </select>
                        </label>
                    </div>

                    <div className="form-section">
                        <span className="form-section-title">Description & Planning</span>
                        <div className="form-grid">
                            <label className="full-width">
                                Détails de la demande
                                <textarea name="description" value={formData.description} onChange={handleChange} rows="4" placeholder="Description détaillée du problème..."></textarea>
                            </label>

                            <label>
                                Date limite
                                <input type="date" name="deadline_date" value={formData.deadline_date} onChange={handleChange} />
                            </label>

                            <label>
                                Temps à résoudre (h)
                                <input type="number" name="resolution_time" value={formData.resolution_time} onChange={handleChange} min="0" />
                            </label>

                            <label className="full-width">
                                Prochaine étape
                                <input type="text" name="next_step" value={formData.next_step} onChange={handleChange} placeholder="Action à venir..." />
                            </label>
                        </div>
                    </div>

                    <div className="form-section">
                        <span className="form-section-title">Résolution & Notes</span>
                        <div className="form-grid">
                            <label>
                                Date de résolution
                                <input type="date" name="resolution_date" value={formData.resolution_date} onChange={handleChange} />
                            </label>

                            <label className="full-width">
                                Commentaire interne
                                <textarea name="comment" value={formData.comment} onChange={handleChange} rows="3" placeholder="Notes internes..."></textarea>
                            </label>

                            <label className="full-width">
                                Fichiers joints
                                <input type="file" multiple />
                            </label>
                        </div>
                    </div>

                    <button type="submit" className="submit-btn">{editData ? "Mettre à jour" : "Créer le ticket"}</button>
                </form>
            </div>
        </div>
    );
}

export default AddTicket;
