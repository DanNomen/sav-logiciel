import React, { useState, useEffect } from "react";
import { FaUserPlus, FaTrashAlt, FaUserShield, FaUserTie } from "react-icons/fa";
import API_BASE_URL from "../api_config";
import "./Settings.css";

function Settings() {
    const [users, setUsers] = useState([]);
    const [editingUserId, setEditingUserId] = useState(null);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        role: "TECHNICIEN",
        full_name: "",
        location: ""
    });


    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`);
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingUserId
                ? `${API_BASE_URL}/api/users/${editingUserId}`
                : `${API_BASE_URL}/api/users`;
            const method = editingUserId ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const data = await response.json();
                alert(editingUserId ? "Utilisateur mis à jour !" : "Utilisateur ajouté !");

                // Si l'utilisateur modifié est celui qui est connecté, on met à jour le localStorage
                const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
                if (editingUserId === currentUser.id) {
                    localStorage.setItem("user", JSON.stringify(data.user));
                    // Déclencher un événement pour que le Sidebar se mette à jour
                    window.dispatchEvent(new Event("userUpdated"));
                }

                resetForm();
                fetchUsers();
            } else {
                alert("Erreur lors de l'opération");
            }
        } catch (error) {
            console.error("Error saving user:", error);
        }
    };

    const handleEdit = (user) => {
        setEditingUserId(user.id);
        setFormData({
            email: user.email,
            password: user.password,
            role: user.role,
            full_name: user.full_name,
            location: user.location || ""
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingUserId(null);
        setFormData({ email: "", password: "", role: "TECHNICIEN", full_name: "", location: "" });
    };

    const handleDelete = async (userId) => {
        if (window.confirm("Supprimer cet utilisateur ?")) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
                    method: "DELETE"
                });
                if (response.ok) {
                    fetchUsers();
                } else {
                    const data = await response.json();
                    alert(data.detail || "Erreur lors de la suppression");
                }
            } catch (error) {
                console.error("Error deleting user:", error);
            }
        }
    };

    return (
        <div className="settings-container">
            <div className="settings-header">
                <h1>Paramètres</h1>
                <p>Gestion de l'application et des accès</p>
            </div>

            <div className="settings-grid">
                {/* User Management Section */}
                <div className="settings-card user-management">
                    <div className="card-header">
                        <FaUserShield size={24} />
                        <h2>Gestion des Utilisateurs</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="add-user-form">
                        <div className="input-group">
                            <label>Nom complet</label>
                            <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} required placeholder="Jean Technicien" />
                        </div>
                        <div className="input-row">
                            <div className="input-group">
                                <label>Email</label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="ex@mgp.mg" />
                            </div>
                            <div className="input-group">
                                <label>Mot de passe</label>
                                <input type="password" name="password" value={formData.password} onChange={handleChange} required />
                            </div>
                        </div>
                        <div className="input-row">
                            <div className="input-group">
                                <label>Rôle</label>
                                <select name="role" value={formData.role} onChange={handleChange} required>
                                    <option value="ADMIN">ADMIN (Accès Total)</option>
                                    <option value="TECHNICIEN">TECHNICIEN (Accès Limité)</option>
                                    <option value="FACTURATION">FACTURATION (Accès Dashboard & Factures)</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Localisation</label>
                                <select name="location" value={formData.location} onChange={handleChange} required>
                                    <option value="">-- Sélectionner --</option>
                                    <option value="Antananarivo">Antananarivo</option>
                                    <option value="Nosy Be">Nosy Be</option>
                                    <option value="Tamatave">Tamatave</option>
                                    <option value="Tulear">Tulear</option>
                                    <option value="Ambovombe">Ambovombe</option>
                                    <option value="Fort Dauphin">Fort Dauphin</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-actions-row">
                            <button type="submit" className="add-user-btn">
                                {editingUserId ? "Enregistrer les modifications" : "Ajouter l'utilisateur"}
                            </button>
                            {editingUserId && (
                                <button type="button" className="cancel-btn" onClick={resetForm}>
                                    Annuler
                                </button>
                            )}
                        </div>
                    </form>

                    <div className="users-list">
                        <h3>Utilisateurs existants</h3>
                        <div className="users-table">
                            {users.map(u => (
                                <div key={u.id} className="user-row">
                                    <div className="user-info">
                                        <div className="user-details">
                                            <span className="user-name">{u.full_name}</span>
                                            <span className="user-email">{u.email}</span>
                                            {u.location && <span className="user-location-tag">📍 {u.location}</span>}
                                        </div>
                                    </div>
                                    <div className="user-role-badge" data-role={u.role}>
                                        {u.role}
                                    </div>
                                    <div className="user-actions">
                                        <button className="edit-btn" onClick={() => handleEdit(u)} title="Modifier">
                                            <FaUserPlus />
                                        </button>
                                        <button className="delete-btn" onClick={() => handleDelete(u.id)} disabled={u.id === "1"}>
                                            <FaTrashAlt />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Role Permissions Summary */}
                <div className="settings-card permissions-card">
                    <div className="card-header">
                        <FaUserTie size={24} />
                        <h2>Droits & Permissions</h2>
                    </div>
                    <div className="permissions-content">
                        <div className="role-perm">
                            <h4>ADMIN</h4>
                            <p>Accès TOTAL : Gestion clients, systèmes, tickets, interventions et paramètres.</p>
                        </div>
                        <div className="role-perm">
                            <h4>TECHNICIEN</h4>
                            <ul>
                                <li>✔ Voir les tickets assignés</li>
                                <li>✔ Modifier le statut des tickets</li>
                                <li>✔ Ajouter des interventions</li>
                                <li>✔ Photos & Commentaires</li>
                                <li className="denied">❌ Supprimer des clients</li>
                                <li className="denied">❌ Accès aux paramètres</li>
                            </ul>
                        </div>
                        <div className="role-perm">
                            <h4>FACTURATION</h4>
                            <ul>
                                <li>✔ Voir le Dashboard</li>
                                <li>✔ Gestion des Factures (CRUD)</li>
                                <li className="denied">❌ Accès aux Clients/Systèmes</li>
                                <li className="denied">❌ Accès aux Interventions/Tickets</li>
                                <li className="denied">❌ Accès aux paramètres</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
