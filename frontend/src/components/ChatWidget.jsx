import React, { useState, useEffect, useRef } from 'react';
import { FaComments, FaPaperPlane, FaTimes, FaMinus, FaUserSecret, FaGlobe } from 'react-icons/fa';
import API_BASE_URL from '../api_config';
import './ChatWidget.css';

function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [newMessage, setNewMessage] = useState('');
    const [recipientId, setRecipientId] = useState(''); // Empty means public
    const [users, setUsers] = useState([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen && !isMinimized) {
            scrollToBottom();
            setUnreadCount(0);
        }
    }, [messages, isOpen, isMinimized]);

    useEffect(() => {
        if (!currentUser.id) return;

        // Fetch messages
        const fetchMessages = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/messages?user_id=${currentUser.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setMessages(data);
                }
            } catch (error) { }
        };

        // Fetch users for recipient list
        const fetchUsers = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/users`);
                if (response.ok) {
                    const data = await response.json();
                    setUsers(data.filter(u => u.id !== currentUser.id));
                }
            } catch (error) { }
        };

        fetchMessages();
        fetchUsers();

        // WebSocket
        const wsUrl = API_BASE_URL.replace('http', 'ws') + `/ws/chat?user_id=${currentUser.id}`;
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            // Increment unread if chat is closed or minimized
            if (!isOpen || isMinimized) {
                if (msg.sender_id !== currentUser.id) {
                    setUnreadCount(prev => prev + 1);
                }
            }

            setMessages(prev => [...prev, msg]);
        };

        return () => { socket.close(); };
    }, [currentUser.id]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const msgData = {
            sender_id: currentUser.id,
            sender_name: currentUser.full_name || 'Anonyme',
            recipient_id: recipientId || null,
            content: newMessage,
            timestamp: new Date().toISOString()
        };

        if (recipientId === 'AI_EXPERT') {
            setIsAiLoading(true);
            // On ajoute le message de l'utilisateur localement immédiatement
            const userMsg = { ...msgData, id: Date.now() };
            setMessages(prev => [...prev, userMsg]);
            setNewMessage('');

            try {
                const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: newMessage, context: "Session de support SAV" })
                });
                if (response.ok) {
                    const data = await response.json();
                    const aiMsg = {
                        sender_id: 'AI_EXPERT',
                        sender_name: 'EXPERT IA MGP',
                        recipient_id: currentUser.id,
                        content: data.content,
                        timestamp: new Date().toISOString()
                    };
                    setMessages(prev => [...prev, aiMsg]);
                }
            } catch (error) {
                console.error("AI Error:", error);
            } finally {
                setIsAiLoading(false);
            }
            return;
        }

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(msgData));
        }

        try {
            await fetch(`${API_BASE_URL}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(msgData)
            });
        } catch (error) { }

        setNewMessage('');
    };

    if (!currentUser.id) return null;

    return (
        <div className={`chat-widget-wrapper ${isOpen ? 'open' : ''} ${isMinimized ? 'minimized' : ''}`}>
            {!isOpen ? (
                <button className="chat-toggle-btn" onClick={() => setIsOpen(true)}>
                    <FaComments size={24} />
                    {unreadCount > 0 && <span className="chat-unread-badge">{unreadCount}</span>}
                </button>
            ) : (
                <div className="chat-window animate-slideUp">
                    <div className="chat-header">
                        <div className="chat-header-info">
                            <div className="online-indicator"></div>
                            <h3>Chat Direct</h3>
                        </div>
                        <div className="chat-header-actions">
                            <button onClick={() => setIsMinimized(!isMinimized)} title="Réduire">
                                <FaMinus />
                            </button>
                            <button onClick={() => setIsOpen(false)} title="Fermer">
                                <FaTimes />
                            </button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <>
                            <div className="chat-recipient-selector">
                                <span className="selector-icon">
                                    {recipientId ? <FaUserSecret color="#a855f7" /> : <FaGlobe color="#6366f1" />}
                                </span>
                                <select
                                    value={recipientId}
                                    onChange={(e) => setRecipientId(e.target.value)}
                                    className="recipient-select"
                                >
                                    <option value="">Tous (Public)</option>
                                    <option value="AI_EXPERT">🤖 EXPERT IA MGP (Privé)</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>Privé: {u.full_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="chat-messages">
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`message-bubble ${msg.sender_id === currentUser.id ? 'own' : ''} ${msg.recipient_id ? 'private' : ''}`}
                                    >
                                        <div className="message-header-row">
                                            {msg.sender_id !== currentUser.id && (
                                                <span className="message-sender">{msg.sender_name}</span>
                                            )}
                                            {msg.recipient_id && (
                                                <span className="private-tag">PRIVÉ</span>
                                            )}
                                        </div>
                                        <div className="message-content">
                                            {msg.content}
                                        </div>
                                        <span className="message-time">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                                {isAiLoading && (
                                    <div className="message-bubble private">
                                        <div className="message-header-row">
                                            <span className="message-sender">EXPERT IA MGP</span>
                                        </div>
                                        <div className="message-content ai-typing">
                                            En train de réfléchir...
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <form className="chat-input-area" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    placeholder={recipientId ? "Message privé..." : "Message public..."}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                                <button type="submit" className="send-btn">
                                    <FaPaperPlane />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default ChatWidget;
