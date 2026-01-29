import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API_BASE_URL from "../api_config";
import "./AddIntervention.css";

function AddIntervention() {
    const navigate = useNavigate();
    const location = useLocation();
    const typeFromState = location.state?.type || "preventive"; // "preventive" or "corrective"
    const editData = location.state?.intervention;
    const initialClientId = location.state?.clientId || "";
    const initialSystemId = location.state?.systemId || "";

    const [clients, setClients] = useState([]);
    const [systems, setSystems] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [formData, setFormData] = useState({
        type: typeFromState,
        title: "",
        client_id: initialClientId,
        system_id: initialSystemId,
        technician: "",
        date: new Date().toISOString().split('T')[0],
        status: "NOUVEAU",
        ticket_id: "",
        observation: "",
        context: "",
        resolution: "",
        material_changed: "",
        images: []
    });

    useEffect(() => {
        fetchClients();
        fetchSystems();
        fetchTickets();
        if (editData) {
            const data = { ...editData };
            if (data.technicien && !data.technician) {
                data.technician = data.technicien;
            }
            setFormData(data);
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

    const fetchSystems = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/systems`);
            if (response.ok) {
                const data = await response.json();
                setSystems(data);
            }
        } catch (error) {
            console.error("Error fetching systems:", error);
        }
    };

    const fetchTickets = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tickets`);
            if (response.ok) {
                const data = await response.json();
                setTickets(data);
            }
        } catch (error) {
            console.error("Error fetching tickets:", error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleFileChange = (e) => {
        console.log("Files:", e.target.files);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const isEdit = !!editData?.id;
            const url = isEdit
                ? `${API_BASE_URL}/api/interventions/${editData.id}`
                : `${API_BASE_URL}/api/interventions`;
            const method = isEdit ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert("Intervention enregistrée !");
                navigate("/interventions");
            } else {
                alert("Erreur lors de l'enregistrement");
            }
        } catch (error) {
            console.error("Error saving intervention:", error);
            alert("Erreur serveur");
        }
    };

    const filteredSystems = formData.client_id
        ? systems.filter(s => s.client_id === formData.client_id)
        : systems;

    const filteredTickets = formData.client_id
        ? tickets.filter(t => t.client_id === formData.client_id)
        : tickets;

    return (
        <div className="add-intervention-container">
            <div className="add-intervention-card">
                <div className="add-intervention-header">
                    <h1 className="add-intervention-title">
                        {editData ? "Modifier l'intervention" : `Nouvelle Intervention ${formData.type === "preventive" ? "Préventive" : "Corrective"}`}
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="add-intervention-form">
                    <div className="form-grid">
                        <label className="full-width">
                            Titre de l'intervention
                            <input type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="Ex: Maintenance annuelle des onduleurs" />
                        </label>

                        <label>
                            Client
                            <select name="client_id" value={formData.client_id} onChange={handleChange} required>
                                <option value="">Choisir un client</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.nom} ({c.client})</option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Système concerné
                            <select name="system_id" value={formData.system_id} onChange={handleChange} required>
                                <option value="">Choisir un système</option>
                                {filteredSystems.map(s => (
                                    <option key={s.id} value={s.id}>{s.monitoring_name}</option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Technicien
                            <input type="text" name="technician" value={formData.technician} onChange={handleChange} required placeholder="Nom du technicien" />
                        </label>

                        <label>
                            Date
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required />
                        </label>

                        <label>
                            Statut actuel
                            <select name="status" value={formData.status} onChange={handleChange} required>
                                <option value="NOUVEAU">NOUVEAU</option>
                                <option value="EN COURS">EN COURS</option>
                                <option value="TERMINÉ">TERMINÉ</option>
                                <option value="EN ATTENTE">EN ATTENTE</option>
                                <option value="ANNULÉ">ANNULÉ</option>
                            </select>
                        </label>

                        <label>
                            Lié au Ticket (optionnel)
                            <select name="ticket_id" value={formData.ticket_id} onChange={handleChange}>
                                <option value="">Aucun ticket lié</option>
                                {filteredTickets.map(t => (
                                    <option key={t.id} value={t.id}>#{t.ticket_number} - {t.subject}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="form-section">
                        <span className="form-section-title">Contenu de l'intervention</span>
                        {formData.type === "preventive" ? (
                            <label className="full-width">
                                Observations détaillées
                                <textarea name="observation" value={formData.observation} onChange={handleChange} rows="6" placeholder="Décrivez les points de contrôle et observations..."></textarea>
                            </label>
                        ) : (
                            <div className="form-grid">
                                <label className="full-width">
                                    Contexte de la panne
                                    <textarea name="context" value={formData.context} onChange={handleChange} rows="3" placeholder="Description du problème initial..."></textarea>
                                </label>
                                <label className="full-width">
                                    Actions de résolution
                                    <textarea name="resolution" value={formData.resolution} onChange={handleChange} rows="3" placeholder="Détails du dépannage effectué..."></textarea>
                                </label>
                                <label className="full-width">
                                    Matériel remplacé
                                    <textarea name="material_changed" value={formData.material_changed} onChange={handleChange} rows="2" placeholder="Liste des pièces changées..."></textarea>
                                </label>
                                <label className="full-width">
                                    Photos de l'intervention
                                    <input type="file" multiple onChange={handleFileChange} accept="image/*" />
                                </label>
                            </div>
                        )}
                    </div>

                    <button type="submit" className="submit-btn">Enregistrer l'intervention</button>
                </form>
            </div>
        </div>
    );
}

export default AddIntervention;
