import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 1,
            sender: 'bot',
            text: "Hello! 👋 I'm your SC Courier virtual assistant. How can I help you today?",
            time: getFormattedTime()
        }
    ]);

    const messagesEndRef = useRef(null);

    // Auto-scroll to the bottom of messages list
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen, isTyping]);

    function getFormattedTime() {
        const date = new Date();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}:${minutes} ${ampm}`;
    }

    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        if (!inputText.trim()) return;

        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: inputText,
            time: getFormattedTime()
        };

        setMessages((prev) => [...prev, userMsg]);
        const query = inputText;
        setInputText('');
        
        // Trigger bot response after a typing delay
        triggerBotResponse(query);
    };

    const handleFaqClick = (faqText) => {
        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: faqText,
            time: getFormattedTime()
        };

        setMessages((prev) => [...prev, userMsg]);
        triggerBotResponse(faqText);
    };

    const triggerBotResponse = (userQuery) => {
        setIsTyping(true);

        setTimeout(() => {
            const botReplyText = generateBotReply(userQuery);
            const botMsg = {
                id: Date.now() + 1,
                sender: 'bot',
                text: botReplyText,
                time: getFormattedTime()
            };
            setMessages((prev) => [...prev, botMsg]);
            setIsTyping(false);
        }, 800);
    };

    const generateBotReply = (query) => {
        const cleanQuery = query.toLowerCase().trim();

        // 1. Check for specific tracking numbers
        const trackingMatch = cleanQuery.match(/sc\d+/i);
        if (trackingMatch) {
            const id = trackingMatch[0].toUpperCase();
            if (id === 'SC101000') {
                return `📦 **Package ID: SC101000**\n\n🟢 **Status**: Approved / In Transit\n📍 **Destination**: Seattle, WA\n📅 **Ordered**: 2024-02-25\n\nYour package is currently in transit and is on schedule.`;
            } else if (id === 'SC101015') {
                return `📦 **Package ID: SC101015**\n\n🔴 **Status**: Declined on delivery\n📍 **Destination**: Denver, CO\n📅 **Ordered**: 2024-03-02\n\nThis delivery was marked as declined. Please contact our support line for further details.`;
            } else if (id === 'SC100892') {
                return `📦 **Package ID: SC100892**\n\n✅ **Status**: Delivered\n📍 **Destination**: Los Angeles, CA\n📅 **Delivery Date**: 2023-10-15\n\nThis package has already been successfully delivered to the recipient.`;
            } else if (id === 'SC100865') {
                return `📦 **Package ID: SC100865**\n\n✅ **Status**: Delivered\n📍 **Destination**: Chicago, IL\n📅 **Delivery Date**: 2023-10-10\n\nThis package has already been successfully delivered to the recipient.`;
            } else if (id === 'SC100810') {
                return `📦 **Package ID: SC100810**\n\n✅ **Status**: Delivered\n📍 **Destination**: Miami, FL\n📅 **Delivery Date**: 2023-09-28\n\nThis package has already been successfully delivered to the recipient.`;
            } else {
                return `📦 **Package ID: ${id}**\n\n🟢 **Status**: In Transit\n📍 **Location**: Distribution Center, NY\n⚡ **Progress**: 60%\n\nYour package is moving smoothly towards its destination.`;
            }
        }

        // 2. Keyword routing
        if (cleanQuery.includes('track') || cleanQuery.includes('status') || cleanQuery.includes('where')) {
            return "To track a package, please enter your tracking number starting with **SC** (for example, try typing **SC101000** or **SC100892**).";
        }

        if (cleanQuery.includes('price') || cleanQuery.includes('cost') || cleanQuery.includes('rate') || cleanQuery.includes('fee') || cleanQuery.includes('charge')) {
            return "💵 **SC Courier Shipping Rates:**\n\n• **Standard Domestic**: $5.00 (up to 1kg) + $1.50 per extra kg.\n• **Express Domestic**: $12.00 (up to 1kg) + $3.00 per extra kg.\n• **International Shipping**: Starts at $25.00 (dependent on destination).\n\nYou can create and view shipments by registering an account and logging in.";
        }

        if (cleanQuery.includes('register') || cleanQuery.includes('signup') || cleanQuery.includes('account') || cleanQuery.includes('join')) {
            return "📝 **How to Register:**\n\n1. Click **'Login to Account'** on the homepage.\n2. Click the **'Register Now'** button below the login form.\n3. Fill in your details (Name, Email, Address, Phone, Password) and click **'Create Account'**.\n\nOnce registered, you can log in to view active packages, track delivery history, and submit delivery requests!";
        }

        if (cleanQuery.includes('contact') || cleanQuery.includes('phone') || cleanQuery.includes('email') || cleanQuery.includes('support') || cleanQuery.includes('number')) {
            return "📞 **Support Channels:**\n\n• **Phone**: +94 77 123 4567\n• **Email**: support@sccourier.com\n• **Office**: 123 Logistics Way, NY 10001\n\nOur customer support line is open 24/7 for delivery inquiries.";
        }

        if (cleanQuery.includes('branch') || cleanQuery.includes('location') || cleanQuery.includes('where are you')) {
            return "📍 Our primary distribution office is located at **123 Logistics Way, NY 10001**.\n\nAll package dispatches are handled through this branch.";
        }

        if (cleanQuery.includes('atr') || cleanQuery.includes('form') || cleanQuery.includes('deliver now')) {
            return "📋 **ATR (Activity Travel Request) Form:**\n\nRegistered customers can request shipments by logging in, navigating to their Dashboard, and clicking **'Deliver Now'**. This opens the ATR form to specify vehicle requirements and trip details.";
        }

        if (cleanQuery.includes('hi') || cleanQuery.includes('hello') || cleanQuery.includes('hey') || cleanQuery.includes('greetings')) {
            return "Hi there! 😊 How can I help you with your courier service needs today?";
        }

        if (cleanQuery.includes('thank') || cleanQuery.includes('thanks') || cleanQuery.includes('cool') || cleanQuery.includes('great')) {
            return "You're very welcome! Let me know if there's anything else I can do for you. 👍";
        }

        // Default fallback
        return "I'm sorry, I didn't quite catch that. 😅 Could you rephrase your question? Or, you can choose one of the quick options below:\n\n• Type **SC101000** to test package tracking.\n• Type **rates** to view shipping costs.\n• Type **contact** to see our support info.";
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                className={`chatbot-trigger-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title={isOpen ? "Close Assistant" : "Ask SC Courier Assistant"}
            >
                {isOpen ? (
                    <i className="bx bx-x"></i>
                ) : (
                    <i className="bx bx-message-rounded-detail"></i>
                )}
            </button>

            {/* Chatbot Window */}
            {isOpen && (
                <div className="chatbot-window">
                    {/* Header */}
                    <div className="chatbot-header">
                        <div className="chatbot-info">
                            <div className="chatbot-avatar">
                                <i className="bx bx-bot"></i>
                            </div>
                            <div className="chatbot-details">
                                <h4>SC Assistant</h4>
                                <div className="chatbot-status">
                                    <span className="chatbot-status-dot"></span>
                                    <span>Always online</span>
                                </div>
                            </div>
                        </div>
                        <button className="chatbot-close-btn" onClick={() => setIsOpen(false)}>
                            <i className="bx bx-x"></i>
                        </button>
                    </div>

                    {/* Messages List */}
                    <div className="chatbot-messages">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`chatbot-msg-wrapper ${msg.sender}`}>
                                <div className="chatbot-msg" style={{ whiteSpace: 'pre-wrap' }}>
                                    {msg.text}
                                </div>
                                <div className="chatbot-msg-time">{msg.time}</div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="chatbot-msg-wrapper bot">
                                <div className="chatbot-msg">
                                    <div className="chatbot-typing">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick FAQs */}
                    <div className="chatbot-quick-faqs">
                        <div className="chatbot-quick-faqs-title">Quick FAQs</div>
                        <div className="chatbot-faq-list">
                            <button
                                className="chatbot-faq-btn"
                                onClick={() => handleFaqClick("Track a package")}
                            >
                                🔍 Track Package
                            </button>
                            <button
                                className="chatbot-faq-btn"
                                onClick={() => handleFaqClick("Shipping rates")}
                            >
                                💵 Shipping Rates
                            </button>
                            <button
                                className="chatbot-faq-btn"
                                onClick={() => handleFaqClick("How to register?")}
                            >
                                📝 How to Register?
                            </button>
                            <button
                                className="chatbot-faq-btn"
                                onClick={() => handleFaqClick("Contact Support")}
                            >
                                📞 Contact Support
                            </button>
                        </div>
                    </div>

                    {/* Input Form */}
                    <form className="chatbot-input-form" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            placeholder="Type your message..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                        <button type="submit" className="chatbot-send-btn">
                            <i className="bx bx-send"></i>
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};

export default Chatbot;
