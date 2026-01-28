import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaPlus, FaEdit, FaTrashAlt, FaCogs, FaUser, FaTools, FaFilter, FaTimes } from "react-icons/fa";
import "./SystemList.css";

function SystemList() {
    const [systems, setSystems] = useState([]);
    const [clients, setClients] = useState({});
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
                <button className="new-system-btn" onClick={() => navigate("/add-system")}>
                    <FaPlus size={20} /> Nouveau Système
                </button>
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
        </div>
    );
}

export default SystemList;
