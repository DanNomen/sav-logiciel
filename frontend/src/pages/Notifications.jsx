import React, { useState, useEffect } from "react";
import { FaBell, FaInfoCircle, FaUserEdit, FaPlusCircle, FaSearch, FaFilter, FaExclamationTriangle, FaCheckDouble } from "react-icons/fa";
import "./Notifications.css";

function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [filterType, setFilterType] = useState("all"); // all, creation, modification, tech
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await fetch("http://localhost:8000/api/notifications");
            if (response.ok) {
                const data = await response.json();
                setNotifications(data);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    const markAsRead = async (notifId) => {
        try {
            const response = await fetch(`http://localhost:8000/api/notifications/${notifId}/read`, { method: "POST" });
            if (response.ok) {
                setNotifications(notifications.map(n => n.id === notifId ? { ...n, read: true } : n));
                window.dispatchEvent(new Event("notificationsUpdated"));
            }
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const response = await fetch("http://localhost:8000/api/notifications/read-all", { method: "POST" });
            if (response.ok) {
                setNotifications(notifications.map(n => ({ ...n, read: true })));
                window.dispatchEvent(new Event("notificationsUpdated"));
            }
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
        }
    };

    const filteredNotifications = notifications.filter(n => {
        const matchesSearch = n.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.details.toLowerCase().includes(searchTerm.toLowerCase());

        if (filterType === "all") return matchesSearch;
        if (filterType === "tech") return matchesSearch && n.role === "TECHNICIEN";
        return matchesSearch && n.type === filterType;
    });

    const getIcon = (type) => {
        switch (type) {
            case "creation": return <FaPlusCircle className="icon-creation" />;
            case "modification": return <FaUserEdit className="icon-modification" />;
            default: return <FaInfoCircle className="icon-default" />;
        }
    };

    return (
        <div className="notifications-container">
            <div className="notifications-header">
                <div className="header-left">
                    <div className="title-group">
                        <h1>Notifications</h1>
                        <span className="notif-count">{notifications.filter(n => !n.read).length} non lue(s)</span>
                    </div>
                </div>

                <div className="header-center">
                    <div className="search-box">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Rechercher par client, utilisateur ou détails..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="header-right">
                    {notifications.some(n => !n.read) && (
                        <button className="read-all-btn" onClick={markAllAsRead}>
                            <FaCheckDouble /> <span className="btn-text">Tout marquer comme lu</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="filter-bar">
                <div className="filter-options">
                    <button
                        className={filterType === 'all' ? 'active' : ''}
                        onClick={() => setFilterType('all')}
                    >
                        Toutes
                    </button>
                    <button
                        className={filterType === 'tech' ? 'active' : ''}
                        onClick={() => setFilterType('tech')}
                    >
                        <FaExclamationTriangle /> Alertes Tech
                    </button>
                    <button
                        className={filterType === 'creation' ? 'active' : ''}
                        onClick={() => setFilterType('creation')}
                    >
                        Créations
                    </button>
                    <button
                        className={filterType === 'modification' ? 'active' : ''}
                        onClick={() => setFilterType('modification')}
                    >
                        Modifications
                    </button>
                </div>
            </div>

            <div className="notifications-list">
                {filteredNotifications.length === 0 ? (
                    <div className="empty-notif">
                        <FaBell size={48} />
                        <p>{searchTerm || filterType !== 'all' ? "Aucun résultat pour ce filtre." : "Aucune nouvelle notification."}</p>
                    </div>
                ) : (
                    filteredNotifications.map((notif) => (
                        <div
                            key={notif.id}
                            className={`notif-card ${notif.role === 'TECHNICIEN' ? 'tech-alert' : ''} ${!notif.read ? 'unread' : ''}`}
                            onClick={() => !notif.read && markAsRead(notif.id)}
                        >
                            <div className="notif-icon">
                                {getIcon(notif.type)}
                            </div>
                            <div className="notif-body">
                                <div className="notif-top">
                                    <span className="notif-item">[{notif.item_type}] {notif.item_name}</span>
                                    <span className="notif-date">{notif.date}</span>
                                </div>
                                <div className="notif-msg">{notif.details}</div>
                                <div className="notif-footer">
                                    Effectué par <span className="user-pill">{notif.user}</span>
                                    <span className={`role-tag ${notif.role}`}>{notif.role}</span>
                                </div>
                            </div>
                            {notif.role === 'TECHNICIEN' && (
                                <div className="admin-alert-badge">ATTENTION ADMIN</div>
                            )}
                            {!notif.read && <div className="unread-dot"></div>}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Notifications;
