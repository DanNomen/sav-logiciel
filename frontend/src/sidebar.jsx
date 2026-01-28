import React, { useState, useEffect } from "react";
import { FaBars, FaTimes, FaUser, FaFileAlt, FaCog, FaSignOutAlt, FaCogs, FaTools, FaTicketAlt, FaBell } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./sidebar.css";

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
  const [notifCount, setNotifCount] = useState(0);
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleUpdate = () => {
      setUser(JSON.parse(localStorage.getItem("user") || "{}"));
    };
    window.addEventListener("userUpdated", handleUpdate);

    // Fetch notifications count
    const fetchNotifCount = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/notifications");
        if (response.ok) {
          const data = await response.json();
          // Count only unread
          const unread = data.filter(n => !n.read).length;
          setNotifCount(unread);
        }
      } catch (err) { }
    };

    fetchNotifCount();
    const interval = setInterval(fetchNotifCount, 10000); // refresh every 10s

    window.addEventListener("notificationsUpdated", fetchNotifCount);

    return () => {
      window.removeEventListener("userUpdated", handleUpdate);
      window.removeEventListener("notificationsUpdated", fetchNotifCount);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
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
            <FaUser /> <span>Dashboard</span>
          </li>
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

          <li className="logout-item" onClick={handleLogout}>
            <FaSignOutAlt /> <span>Déconnexion</span>
          </li>
        </ul>
      </div>

      {isOpen && <div className="overlay" onClick={toggleSidebar}></div>}
    </>
  );
}

export default Sidebar;
