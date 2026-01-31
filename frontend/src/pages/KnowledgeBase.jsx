import React, { useEffect, useState } from "react";
import "./KnowledgeBase.css";
import { FaSearch, FaPlus, FaBook, FaTag, FaUser, FaClock, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import API_BASE_URL from "../api_config";

function KnowledgeBase() {
    const [articles, setArticles] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [isEditing, setIsEditing] = useState(false); // To show form
    const [currentArticle, setCurrentArticle] = useState(null); // For edit/create form data

    const user = JSON.parse(localStorage.getItem("user") || "{}");

    useEffect(() => {
        fetchArticles();
    }, []);

    const fetchArticles = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/articles`);
            if (res.ok) {
                const data = await res.json();
                setArticles(data.reverse()); // Show newest first
            }
        } catch (err) {
            console.error("Error fetching articles:", err);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value.toLowerCase());
    };

    const filteredArticles = articles.filter(a =>
        a.title.toLowerCase().includes(searchTerm) ||
        a.content.toLowerCase().includes(searchTerm) ||
        a.tags.toLowerCase().includes(searchTerm)
    );

    const handleDelete = async (id) => {
        if (window.confirm("Voulez-vous vraiment supprimer cet article ?")) {
            try {
                await fetch(`${API_BASE_URL}/api/articles/${id}`, { method: 'DELETE' });
                fetchArticles();
                setSelectedArticle(null);
                setIsEditing(false);
            } catch (err) {
                console.error("Error deleting article:", err);
            }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const articleData = {
            ...currentArticle,
            author_name: user.full_name || "Admin"
        };

        try {
            let res;
            if (currentArticle.id) {
                res = await fetch(`${API_BASE_URL}/api/articles/${currentArticle.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(articleData)
                });
            } else {
                res = await fetch(`${API_BASE_URL}/api/articles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(articleData)
                });
            }

            if (res.ok) {
                fetchArticles();
                setIsEditing(false);
                setCurrentArticle(null);
            }
        } catch (err) {
            console.error("Error saving article:", err);
        }
    };

    const startNewArticle = () => {
        setCurrentArticle({
            title: "",
            category: "Général",
            tags: "",
            content: ""
        });
        setIsEditing(true);
        setSelectedArticle(null);
    };

    const openEdit = (article) => {
        setCurrentArticle(article);
        setIsEditing(true);
    };

    return (
        <div className="knowledge-container">
            <div className="knowledge-header">
                <div>
                    <h1>Base de Connaissance</h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>Centralisez vos procédures et solutions techniques</p>
                </div>
                <button className="add-article-btn" onClick={startNewArticle}>
                    <FaPlus /> Nouvel Article
                </button>
            </div>

            {!isEditing && !selectedArticle && (
                <>
                    <div className="search-bar-knowledge">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Rechercher une panne, un code erreur, une procédure..."
                            value={searchTerm}
                            onChange={handleSearch}
                        />
                    </div>

                    <div className="article-grid">
                        {filteredArticles.length === 0 ? (
                            <div className="no-result" style={{ color: 'white', textAlign: 'center', gridColumn: '1/-1', padding: '3rem' }}>
                                <FaBook size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                <p>Aucun article trouvé. Soyez le premier à partager une solution !</p>
                            </div>
                        ) : (
                            filteredArticles.map(article => (
                                <div key={article.id} className="article-card" onClick={() => setSelectedArticle(article)}>
                                    <span className="article-category">{article.category}</span>
                                    <h3>{article.title}</h3>
                                    <p className="article-preview">{article.content}</p>
                                    <div className="article-tags">
                                        {article.tags.split(',').map((tag, idx) => (
                                            <span key={idx} className="tag-pill"><FaTag size={10} style={{ marginRight: '4px' }} /> {tag.trim()}</span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* View Modal */}
            {selectedArticle && !isEditing && (
                <div className="modal-overlay" onClick={() => setSelectedArticle(null)}>
                    <div className="article-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="article-modal-header">
                            <div className="article-header-info">
                                <span className="article-category" style={{ display: 'inline-block' }}>{selectedArticle.category}</span>
                                <h2>{selectedArticle.title}</h2>
                                <div className="article-meta">
                                    <span><FaUser /> {selectedArticle.author_name}</span>
                                    <span><FaClock /> {selectedArticle.created_at}</span>
                                </div>
                            </div>
                            <div className="article-modal-actions">
                                <button className="edit-article-btn" onClick={() => openEdit(selectedArticle)} title="Modifier">
                                    <FaEdit size={18} />
                                </button>
                                <button className="delete-article-btn" onClick={() => handleDelete(selectedArticle.id)} title="Supprimer">
                                    <FaTrash size={18} />
                                </button>
                                <button className="close-btn" onClick={() => setSelectedArticle(null)}>
                                    <FaTimes size={24} />
                                </button>
                            </div>
                        </div>
                        <div className="article-modal-body">
                            <div style={{ whiteSpace: 'pre-wrap' }}>{selectedArticle.content}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit/Create Form */}
            {isEditing && (
                <div className="modal-overlay">
                    <div className="article-modal-content" style={{ maxWidth: '800px' }}>
                        <div className="article-modal-header">
                            <h2>{currentArticle.id ? "Modifier l'article" : "Nouvel Article"}</h2>
                            <button className="close-btn" onClick={() => setIsEditing(false)}>
                                <FaTimes size={24} />
                            </button>
                        </div>
                        <div className="article-modal-body">
                            <form className="editor-form" onSubmit={handleSave}>
                                <input
                                    type="text"
                                    placeholder="Titre de la solution (ex: Erreur 504 sur Onduleur Huawei)"
                                    value={currentArticle.title}
                                    onChange={e => setCurrentArticle({ ...currentArticle, title: e.target.value })}
                                    required
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <select
                                        value={currentArticle.category}
                                        onChange={e => setCurrentArticle({ ...currentArticle, category: e.target.value })}
                                    >
                                        <option value="Général">Général</option>
                                        <option value="Onduleurs">Onduleurs</option>
                                        <option value="Batteries">Batteries</option>
                                        <option value="Monitoring">Monitoring & Réseau</option>
                                        <option value="Procédures">Procédures Administratives</option>
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Tags (séparés par virgule: erreur, wifi, ...)"
                                        value={currentArticle.tags}
                                        onChange={e => setCurrentArticle({ ...currentArticle, tags: e.target.value })}
                                    />
                                </div>
                                <textarea
                                    placeholder="Décrivez la procédure de résolution étape par étape..."
                                    value={currentArticle.content}
                                    onChange={e => setCurrentArticle({ ...currentArticle, content: e.target.value })}
                                    required
                                ></textarea>

                                <div className="editor-actions">
                                    <button type="button" className="cancel-btn" onClick={() => setIsEditing(false)}>Annuler</button>
                                    <button type="submit" className="save-btn">Enregistrer la solution</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default KnowledgeBase;
