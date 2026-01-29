import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API_BASE_URL from "../api_config";
import "./AddSystem.css";

function AddSystem() {
    const navigate = useNavigate();
    const location = useLocation();
    const editData = location.state?.system;
    const initialClientId = location.state?.clientId || "";

    const [clients, setClients] = useState([]);
    const [formData, setFormData] = useState({
        monitoring_name: "",
        engineer: "",
        agency: "",
        installation_type: "",
        power_va: 0,
        commissioning_date: "",
        contract_type: "",
        contract_duration_months: 0,
        client_id: initialClientId,
        site_technician_name: "",
        site_technician_phone: "",
        victron_site_id: "",
        comments: "",
        location: "",
        pv_type: "",
        pv_count: 0,
        inverter_charger_type: "",
        inverter_charger_count: 0,
        pv_inverter_type: "",
        pv_inverter_count: 0,
        battery_type: "",
        battery_count: 0,
        solar_regulator_type: "",
        solar_regulator_count: 0,
        paid: false,
        next_payment_date: ""
    });

    useEffect(() => {
        fetchClients();
        if (editData) {
            // Remplissage robuste pour éviter les champs null qui "vident" les inputs
            const safeData = { ...formData };
            Object.keys(formData).forEach(key => {
                if (editData[key] !== undefined && editData[key] !== null) {
                    safeData[key] = editData[key];
                }
            });
            setFormData(safeData);
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

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let finalValue = type === "checkbox" ? checked : value;

        // Convert numbers to integers for numeric fields
        if (type === "number") {
            finalValue = value === "" ? 0 : parseInt(value, 10);
        }

        setFormData({
            ...formData,
            [name]: finalValue
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const isEdit = !!editData?.id;
            const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
            const userName = currentUser.full_name || "Inconnu";
            const userRole = currentUser.role || "TECHNICIEN";

            const baseUrl = isEdit
                ? `${API_BASE_URL}/api/systems/${editData.id}`
                : `${API_BASE_URL}/api/systems`;

            const url = `${baseUrl}?user_name=${encodeURIComponent(userName || "Inconnu")}&user_role=${encodeURIComponent(userRole || "TECHNICIEN")}`;
            const method = isEdit ? "PUT" : "POST";

            console.log("DEBUG: Sending system data to API:", formData);

            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert(isEdit ? "Système mis à jour !" : "Système ajouté avec succès !");
                navigate("/systems");
            } else {
                alert("Erreur lors de l'enregistrement");
            }
        } catch (error) {
            console.error("Error saving system:", error);
            alert("Erreur serveur");
        }
    };

    return (
        <div className="add-system-container">
            <div className="add-system-card">
                <div className="add-system-header">
                    <h1 className="add-system-title">
                        {editData ? "Modifier le système" : "Ajouter un système"}
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="add-system-form">
                    <div className="form-section">
                        <h3>Informations Générales</h3>
                        <div className="form-grid">
                            <label>
                                Nom sur le monitoring
                                <input type="text" name="monitoring_name" value={formData.monitoring_name} onChange={handleChange} required />
                            </label>

                            <label>
                                Ingénieur référent
                                <select name="engineer" value={formData.engineer} onChange={handleChange} required>
                                    <option value="">Sélectionner</option>
                                    <option value="Miary">Miary</option>
                                    <option value="Misa">Misa</option>
                                    <option value="Luc">Luc</option>
                                    <option value="Halband">Halband</option>
                                    <option value="Gauthier">Gauthier</option>
                                </select>
                            </label>

                            <label>
                                Agence de référence
                                <select name="agency" value={formData.agency} onChange={handleChange} required>
                                    <option value="">Sélectionner</option>
                                    <option value="Antananarivo">Antananarivo</option>
                                    <option value="Nosy Be">Nosy Be</option>
                                    <option value="Tuléear">Tuléear</option>
                                    <option value="Tamatave">Tamatave</option>
                                    <option value="Ambovombe">Ambovombe</option>
                                    <option value="Fort Dauphin">Fort Dauphin</option>
                                </select>
                            </label>

                            <label>
                                Type installation
                                <select name="installation_type" value={formData.installation_type} onChange={handleChange} required>
                                    <option value="">Sélectionner</option>
                                    <option value="KAD">KAD</option>
                                    <option value="ESS">ESS</option>
                                    <option value="ATAUNOME">ATAUNOME</option>
                                    <option value="CONNECTE RESEAU">CONNECTE RESEAU</option>
                                    <option value="HYBRIDE">HYBRIDE</option>
                                    <option value="AUTRE">AUTRE</option>
                                </select>
                            </label>

                            <label>
                                Puissance nominale (VA)
                                <input type="number" name="power_va" value={formData.power_va} onChange={handleChange} required />
                            </label>

                            <label>
                                Date mise en service
                                <input type="date" name="commissioning_date" value={formData.commissioning_date} onChange={handleChange} required />
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
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Contrat & Paiement</h3>
                        <div className="form-grid">
                            <label>
                                Type de Contrat
                                <select name="contract_type" value={formData.contract_type} onChange={handleChange} required>
                                    <option value="">Sélectionner</option>
                                    <option value="Cooper">Cooper</option>
                                    <option value="Silver">Silver</option>
                                    <option value="Silver+">Silver+</option>
                                    <option value="Gold">Gold</option>
                                    <option value="Gold+">Gold+</option>
                                    <option value="Platinium">Platinium</option>
                                    <option value="Autre">Autre</option>
                                </select>
                            </label>

                            <label>
                                Durée contrat (mois)
                                <input type="number" name="contract_duration_months" value={formData.contract_duration_months} onChange={handleChange} required />
                            </label>

                            <label className="checkbox-label">
                                <input type="checkbox" name="paid" checked={formData.paid} onChange={handleChange} />
                                <span>Payé</span>
                            </label>

                            <label>
                                Prochain paiement
                                <input type="date" name="next_payment_date" value={formData.next_payment_date} onChange={handleChange} />
                            </label>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Technique & Matériel</h3>
                        <div className="form-grid">
                            <label>Victron ID site
                                <input type="text" name="victron_site_id" value={formData.victron_site_id} onChange={handleChange} />
                            </label>
                            <label>Localisation
                                <input type="text" name="location" value={formData.location} onChange={handleChange} />
                            </label>
                            <label>Type PV
                                <input type="text" name="pv_type" value={formData.pv_type} onChange={handleChange} />
                            </label>
                            <label>Nombre PV
                                <input type="number" name="pv_count" value={formData.pv_count} onChange={handleChange} />
                            </label>
                            <label>Type Onduleur Chargeur
                                <input type="text" name="inverter_charger_type" value={formData.inverter_charger_type} onChange={handleChange} />
                            </label>
                            <label>Nombre Onduleur Chargeur
                                <input type="number" name="inverter_charger_count" value={formData.inverter_charger_count} onChange={handleChange} />
                            </label>
                            <label>Type Onduleur PV
                                <input type="text" name="pv_inverter_type" value={formData.pv_inverter_type} onChange={handleChange} />
                            </label>
                            <label>Nombre Onduleur PV
                                <input type="number" name="pv_inverter_count" value={formData.pv_inverter_count} onChange={handleChange} />
                            </label>
                            <label>Type Batterie
                                <input type="text" name="battery_type" value={formData.battery_type} onChange={handleChange} />
                            </label>
                            <label>Nombre Batterie
                                <input type="number" name="battery_count" value={formData.battery_count} onChange={handleChange} />
                            </label>
                            <label>Type Régulateur
                                <input type="text" name="solar_regulator_type" value={formData.solar_regulator_type} onChange={handleChange} />
                            </label>
                            <label>Nombre Régulateur
                                <input type="number" name="solar_regulator_count" value={formData.solar_regulator_count} onChange={handleChange} />
                            </label>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3>Contact Chantier & Notes</h3>
                        <div className="form-grid">
                            <label>Nom technicien chantier
                                <input type="text" name="site_technician_name" value={formData.site_technician_name} onChange={handleChange} />
                            </label>
                            <label>Téléphone technicien chantier
                                <input type="text" name="site_technician_phone" value={formData.site_technician_phone} onChange={handleChange} />
                            </label>
                            <label className="full-width">Commentaires
                                <textarea name="comments" value={formData.comments} onChange={handleChange} rows="4"></textarea>
                            </label>
                        </div>
                    </div>

                    <button type="submit" className="submit-btn">Sauvegarder</button>
                </form>
            </div>
        </div>
    );
}

export default AddSystem;
