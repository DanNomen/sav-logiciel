import React, { useState, useEffect, useRef } from "react";
import { FaPaperPlane, FaSearch, FaUserCircle, FaGlobe, FaLock, FaCheck, FaCheckDouble } from "react-icons/fa";
import API_BASE_URL from "../api_config";
import "./Messages.css";

function Messages() {
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null); // null = GROUPE (Global)
    const [newMessage, setNewMessage] = useState("");
    const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem("user") || "{}"));
    const [searchTerm, setSearchTerm] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [remoteTyping, setRemoteTyping] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, remoteTyping]);

    // Mark as read when selecting a user
    useEffect(() => {
        if (selectedUser) {
            markAsRead(selectedUser.id);
        }
    }, [selectedUser, messages]);

    useEffect(() => {
        fetchUsers();
        fetchMessages();

        const wsUrl = API_BASE_URL.replace("http", "ws") + `/ws/chat?user_id=${currentUser.id}`;
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "typing") {
                if (selectedUser && data.sender_id === selectedUser.id) {
                    setRemoteTyping(true);
                    setTimeout(() => setRemoteTyping(false), 3000);
                }
            } else {
                setMessages(prev => [...prev, data]);
            }
        };

        return () => socket.close();
    }, [currentUser.id, selectedUser?.id]);

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/users`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data.filter(u => u.id !== currentUser.id));
            }
        } catch (err) { }
    };

    const fetchMessages = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/messages?user_id=${currentUser.id}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) { }
    };

    const markAsRead = async (senderId) => {
        try {
            await fetch(`${API_BASE_URL}/api/messages/mark-read`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sender_id: senderId, recipient_id: currentUser.id })
            });
        } catch (err) { }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const msgData = {
            sender_id: currentUser.id,
            sender_name: currentUser.full_name || "Anonyme",
            recipient_id: selectedUser ? selectedUser.id : null,
            content: newMessage,
            timestamp: new Date().toISOString()
        };

        if (selectedUser?.id === "AI_EXPERT") {
            setIsAiLoading(true);
            const userMsg = { ...msgData, id: Date.now() };
            setMessages(prev => [...prev, userMsg]);
            setNewMessage("");

            try {
                const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: newMessage, context: "Session technique Expert" })
                });
                if (response.ok) {
                    const data = await response.json();
                    const aiMsg = {
                        sender_id: "AI_EXPERT",
                        sender_name: "EXPERT IA MGP",
                        recipient_id: currentUser.id,
                        content: data.content,
                        timestamp: new Date().toISOString(),
                        id: Date.now() + 1
                    };
                    setMessages(prev => [...prev, aiMsg]);
                }
            } catch (err) { } finally {
                setIsAiLoading(false);
            }
            return;
        }

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(msgData));
        }

        try {
            await fetch(`${API_BASE_URL}/api/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(msgData)
            });
        } catch (err) { }

        setNewMessage("");
        setRemoteTyping(false);
    };

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);

        // Typing indicator
        if (selectedUser && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: "typing",
                sender_id: currentUser.id,
                recipient_id: selectedUser.id
            }));
        }
    };

    const getLastMessage = (userId) => {
        const userMsgs = messages.filter(m =>
            (m.sender_id === currentUser.id && m.recipient_id === userId) ||
            (m.sender_id === userId && m.recipient_id === currentUser.id)
        );
        return userMsgs[userMsgs.length - 1];
    };

    const getUnreadCount = (userId) => {
        return messages.filter(m => m.sender_id === userId && m.recipient_id === currentUser.id && !m.read).length;
    };

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeMessages = messages.filter(m => {
        if (!selectedUser) return !m.recipient_id;
        return (m.sender_id === currentUser.id && m.recipient_id === selectedUser.id) ||
            (m.sender_id === selectedUser.id && m.recipient_id === currentUser.id);
    });

    return (
        <div className="whatsapp-container">
            <div className="whatsapp-sidebar">
                <div className="whatsapp-sidebar-header">
                    <div className="user-profile">
                        <FaUserCircle size={40} color="#cbd5e1" />
                        <div className="user-status">
                            <span className="user-name-curr">{currentUser.full_name}</span>
                            <span className="online-tag">En ligne</span>
                        </div>
                    </div>
                </div>

                <div className="whatsapp-search">
                    <div className="search-input-wrapper">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Rechercher un contact..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="whatsapp-chat-list">
                    <div className={`chat-item ${!selectedUser ? "active" : ""}`} onClick={() => setSelectedUser(null)}>
                        <div className="chat-avatar group"><FaGlobe size={24} color="white" /></div>
                        <div className="chat-info">
                            <div className="chat-header-row"><span className="chat-name">GROUPE</span></div>
                            <p className="chat-last-msg">Discussion générale</p>
                        </div>
                    </div>

                    <div className="list-divider">MESSAGES PRIVÉS</div>

                    <div className={`chat-item ai-contact ${selectedUser?.id === "AI_EXPERT" ? "active" : ""}`} onClick={() => setSelectedUser({ id: "AI_EXPERT", full_name: "EXPERT IA MGP" })}>
                        <div className="chat-avatar private ai"><FaUserCircle size={32} color="#10b981" /></div>
                        <div className="chat-info">
                            <div className="chat-header-row"><span className="chat-name">🤖 EXPERT IA MGP</span></div>
                            <p className="chat-last-msg">Assistant technique intelligent</p>
                        </div>
                    </div>

                    {filteredUsers.map(user => {
                        const lastMsg = getLastMessage(user.id);
                        const unread = getUnreadCount(user.id);
                        return (
                            <div key={user.id} className={`chat-item ${selectedUser?.id === user.id ? "active" : ""}`} onClick={() => setSelectedUser(user)}>
                                <div className="chat-avatar private"><FaUserCircle size={32} color="#6366f1" /></div>
                                <div className="chat-info">
                                    <div className="chat-header-row">
                                        <span className="chat-name">{user.full_name}</span>
                                        {lastMsg && <span className="chat-time-mini">{new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                    </div>
                                    <div className="chat-footer-row">
                                        <p className="chat-last-msg">{lastMsg ? lastMsg.content : "Démarrer une discussion"}</p>
                                        {unread > 0 && <span className="unread-badge-mini">{unread}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="whatsapp-main">
                <div className="chat-header-main">
                    <div className="current-chat-info">
                        <div className={`chat-avatar ${selectedUser ? "private" : "group"}`}>
                            {selectedUser ? <FaUserCircle size={32} /> : <FaGlobe size={24} />}
                        </div>
                        <div className="header-text">
                            <h3>{selectedUser ? selectedUser.full_name : "GROUPE"}</h3>
                            <span>{remoteTyping ? "en train d'écrire..." : (selectedUser ? "Confidentiel" : "Public")}</span>
                        </div>
                    </div>
                </div>

                <div className="chat-messages-area">
                    {activeMessages.length === 0 && !remoteTyping ? (
                        <div className="no-messages">
                            <div className="no-msg-icon">
                                {selectedUser ? <FaLock size={48} /> : <FaGlobe size={48} />}
                            </div>
                            <h3>Pas encore de messages</h3>
                            <p>Commencez la conversation avec {selectedUser ? selectedUser.full_name : "le groupe"} !</p>
                        </div>
                    ) : (
                        activeMessages.map((msg, idx) => (
                            <div key={idx} className={`msg-row ${msg.sender_id === currentUser.id ? "msg-own" : "msg-other"}`}>
                                <div className="msg-bubble">
                                    {msg.sender_id !== currentUser.id && !selectedUser && <span className="msg-sender">{msg.sender_name}</span>}
                                    <div className="msg-content">{msg.content}</div>
                                    <div className="msg-meta">
                                        <span className="msg-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        {msg.sender_id === currentUser.id && msg.recipient_id && (
                                            <span className="msg-status-icon">
                                                {msg.read ? <FaCheckDouble size={12} color="#53bdeb" /> : <FaCheck size={12} />}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {isAiLoading && (
                        <div className="msg-row msg-other">
                            <div className="msg-bubble">
                                <span className="msg-sender">EXPERT IA MGP</span>
                                <div className="msg-content">Réflexion en cours...</div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-footer">
                    <form className="msg-input-form" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            placeholder="Tapez un message..."
                            value={newMessage}
                            onChange={handleInputChange}
                        />
                        <button type="submit" className="msg-send-btn"><FaPaperPlane /></button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Messages;
