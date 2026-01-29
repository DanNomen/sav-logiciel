import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API_BASE_URL from "../api_config";
import "./AddClient.css";

function AddClient() {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state?.client;

  const [formData, setFormData] = useState({
    client: "",
    nom: "",
    telephone: "",
    email: "",
    categorie: "",
    localisation: "",
    technicien: "",
    contrat: null
  });

  useEffect(() => {
    if (editData) {
      setFormData({
        ...editData,
        contrat: null
      });
    }
  }, [editData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, contrat: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { contrat, ...clientData } = formData;
      const isEdit = !!editData?.id;
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      const userName = currentUser.full_name || "Inconnu";
      const userRole = currentUser.role || "TECHNICIEN";

      const baseUrl = isEdit
        ? `${API_BASE_URL}/api/clients/${editData.id}`
        : `${API_BASE_URL}/api/clients`;
      const url = `${baseUrl}?user_name=${encodeURIComponent(userName || "Inconnu")}&user_role=${encodeURIComponent(userRole || "TECHNICIEN")}`;
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientData)
      });

      if (response.ok) {
        alert(isEdit ? "Client mis à jour !" : "Client ajouté avec succès !");
        navigate("/clients");
      } else {
        alert("Erreur lors de l'enregistrement");
      }
    } catch (error) {
      console.error("Error saving client:", error);
      alert("Erreur serveur");
    }
  };

  return (
    <div className="add-client-container">
      <div className="add-client-card">
        <div className="add-client-header">
          <h1 className="add-client-title">
            {editData ? "Modifier le client" : "Nouveau Client"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="add-client-form">
          <div className="form-grid">
            <label>
              Nom complet
              <input type="text" name="nom" value={formData.nom} onChange={handleChange} required placeholder="Ex: Jean Dupont" />
            </label>
            <label>
              Code Client / Société
              <input type="text" name="client" value={formData.client} onChange={handleChange} required placeholder="Ex: SOC123" />
            </label>
            <label>
              Téléphone
              <input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} required placeholder="Ex: 034 00 000 00" />
            </label>
            <label>
              Email
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Ex: contact@societe.com" />
            </label>
            <label>
              Catégorie
              <select name="categorie" value={formData.categorie} onChange={handleChange} required>
                <option value="">Sélectionner</option>
                <option value="petrolier">Pétrolier</option>
                <option value="ong">ONG</option>
                <option value="bailleur">Bailleur</option>
                <option value="societe">Société</option>
                <option value="particulier">Particulier</option>
              </select>
            </label>
            <label>
              Localisation
              <input type="text" name="localisation" value={formData.localisation} onChange={handleChange} placeholder="Ex: Antananarivo" />
            </label>
            <label>
              Technicien référent
              <input type="text" name="technicien" value={formData.technicien} onChange={handleChange} placeholder="Nom du technicien" />
            </label>
            <label>
              Document (contrat)
              <input type="file" onChange={handleFileChange} />
            </label>
          </div>

          <button type="submit" className="submit-btn">{editData ? "Mettre à jour" : "Ajouter le client"}</button>
        </form>
      </div>
    </div>
  );
}

export default AddClient;
