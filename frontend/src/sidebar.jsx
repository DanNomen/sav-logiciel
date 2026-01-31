import React, { useState, useEffect } from "react";
import { FaBars, FaTimes, FaUser, FaFileAlt, FaCog, FaSignOutAlt, FaCogs, FaTools, FaTicketAlt, FaBell, FaComments, FaCalendarAlt, FaChartPie, FaBook } from "react-icons/fa";


import { useNavigate } from "react-router-dom";
import API_BASE_URL from "./api_config";
import "./sidebar.css";

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const [notifCount, setNotifCount] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setUser(JSON.parse(localStorage.getItem("user") || "{}"));
    };
    window.addEventListener("userUpdated", handleUpdate);

    // Fetch notifications count
    const fetchNotifCount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/notifications`);
        if (response.ok) {
          const data = await response.json();
          const unread = data.filter(n => !n.read).length;
          setNotifCount(unread);
        }
      } catch (err) { }
    };

    // Fetch unread messages count
    const fetchUnreadMessages = async () => {
      if (!user.id) return;
      try {
        const response = await fetch(`${API_BASE_URL}/api/messages?user_id=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          // Count messages where I am recipient and read is false
          const unread = data.filter(m => m.recipient_id === user.id && !m.read).length;
          setUnreadMsgCount(unread);
        }
      } catch (err) { }
    };

    fetchNotifCount();
    fetchUnreadMessages();

    // Interval for both
    const interval = setInterval(() => {
      fetchNotifCount();
      fetchUnreadMessages();
    }, 10000);

    window.addEventListener("notificationsUpdated", fetchNotifCount);
    // On peut aussi écouter un événement custom pour le chat si besoin

    return () => {
      window.removeEventListener("userUpdated", handleUpdate);
      window.removeEventListener("notificationsUpdated", fetchNotifCount);
      clearInterval(interval);
    };
  }, [user.id]);

  const handleLogoutClick = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setCurrentTime(timeStr);
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const isWorkingHours = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    return (timeInMinutes >= 8 * 60 && timeInMinutes < 12 * 60) ||
      (timeInMinutes >= 13 * 60 && timeInMinutes <= (16 * 60 + 30));
  };

  return (
    <>
      <div className="hamburger" onClick={toggleSidebar}>
        {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
      </div>

      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        <h2 className="sidebar-title">MADAGREEN SAV</h2>

        <div className="user-profile-mini">
          <div className="user-info-text">
            <span className="user-name">{user.full_name || "Utilisateur"}</span>
            <span className="user-role">{user.role || "Rôle"}</span>
          </div>
        </div>

        <ul className="sidebar-menu">
          <li onClick={() => { navigate("/dashboard"); toggleSidebar(); }}>
            <FaChartPie /> <span>Tableau de Bord</span>
          </li>
          <li onClick={() => { navigate("/planning"); toggleSidebar(); }}>
            <FaCalendarAlt /> <span>Planning</span>
          </li>
          {user.role !== "FACTURATION" && (
            <>
              <li onClick={() => { navigate("/clients"); toggleSidebar(); }}>
                <FaFileAlt /> <span>Clients</span>
              </li>
              <li onClick={() => { navigate("/systems"); toggleSidebar(); }}>
                <FaCogs /> <span>Liste Systèmes</span>
              </li>
              <li onClick={() => { navigate("/interventions"); toggleSidebar(); }}>
                <FaTools /> <span>Interventions</span>
              </li>
              <li onClick={() => { navigate("/tickets"); toggleSidebar(); }}>
                <FaTicketAlt /> <span>Tickets</span>
              </li>
            </>
          )}
          <li onClick={() => { navigate("/invoices"); toggleSidebar(); }}>
            <FaFileAlt /> <span>Facturation</span>
          </li>
          <li onClick={() => { navigate("/messages"); toggleSidebar(); }} className="notif-menu-item">
            <FaComments /> <span>Messages</span>
            {unreadMsgCount > 0 && <span className="notif-badge">{unreadMsgCount}</span>}
          </li>
          <li onClick={() => { navigate("/knowledge-base"); toggleSidebar(); }}>
            <FaBook /> <span>Base Connaissance</span>
          </li>

          {user.role === "ADMIN" && (
            <>
              <li onClick={() => { navigate("/notifications"); toggleSidebar(); }} className="notif-menu-item">
                <FaBell /> <span>Notifications</span>
                {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
              </li>
              <li onClick={() => { navigate("/settings"); toggleSidebar(); }}>
                <FaCog /> <span>Paramètres</span>
              </li>
            </>
          )}

        </ul>

        <div className="sidebar-footer">
          <li className="logout-item-btn" onClick={handleLogoutClick}>
            <FaSignOutAlt /> <span>Déconnexion</span>
          </li>
          <div className="sidebar-version">V-2026-29-0001</div>
        </div>
      </div>

      {showLogoutModal && (
        <div className="logout-modal-overlay">
          <div className="logout-card animate-fadeIn">
            <div className="logout-card-icon">
              <FaSignOutAlt size={40} />
            </div>
            <h3>Déconnexion</h3>
            <p className="logout-message">
              {isWorkingHours() ? (
                <>
                  Vous êtes sur le point de vous déconnecter alors qu'il est <strong>{currentTime}</strong>.
                  <br />
                  Il faut travailler Monsieur <strong>{user.full_name?.toUpperCase() || "L'UTILISATEUR"}</strong> !
                </>
              ) : (
                "Vous êtes sur le point de vous déconnecter."
              )}
            </p>
            <div className="logout-card-actions">
              <button className="cancel-btn" onClick={() => setShowLogoutModal(false)}>
                {isWorkingHours() ? "Retourner au travail" : "Annuler"}
              </button>
              {!isWorkingHours() && (
                <button className="confirm-logout-btn" onClick={confirmLogout}>Se déconnecter</button>
              )}
            </div>
          </div>
        </div>
      )}

      {isOpen && <div className="overlay" onClick={toggleSidebar}></div>}
    </>
  );
}

export default Sidebar;
