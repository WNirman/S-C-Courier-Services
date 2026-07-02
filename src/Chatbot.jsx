import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';

const translations = {
    EN: {
        title: "SC Assistant",
        status: "Always online",
        welcome: "Hello! 👋 I'm your SC Courier virtual assistant. How can I help you today?",
        faqTitle: "Quick FAQs",
        inputPlaceholder: "Type your message...",
        clearConfirm: "Are you sure you want to clear this conversation?",
        faqs: [
            { text: "🔍 Track Package", query: "Track a package" },
            { text: "💵 Shipping Rates", query: "Shipping rates" },
            { text: "📝 How to Register?", query: "How to register?" },
            { text: "📞 Contact Support", query: "Contact Support" }
        ]
    },
    SI: {
        title: "SC සහායකයා",
        status: "සැමවිටම සබැඳිව",
        welcome: "ආයුබෝවන්! 👋 මම ඔබේ SC Courier අතථ්‍ය සහායකයා. අද මම ඔබට උදව් කරන්නේ කෙසේද?",
        faqTitle: "ප්‍රශ්න සහ පිළිතුරු",
        inputPlaceholder: "පණිවිඩය ලියන්න...",
        clearConfirm: "ඔබට මෙම සංවාදය මකා දැමීමට අවශ්‍ය බව ස්ථිරද?",
        faqs: [
            { text: "🔍 පැකේජය ලුහුබඳින්න", query: "පැකේජය ලුහුබඳින්න" },
            { text: "💵 නැව්ගත කිරීමේ ගාස්තු", query: "නැව්ගත කිරීමේ ගාස්තු" },
            { text: "📝 ලියාපදිංචි වන්නේ කෙසේද?", query: "ලියාපදිංචි වන්නේ කෙසේද?" },
            { text: "📞 සහාය අමතන්න", query: "සහාය අමතන්න" }
        ]
    },
    TA: {
        title: "SC உதவிப்பாளர்",
        status: "எப்போது ஆன்லைனில்",
        welcome: "வணக்கம்! 👋 நான் உங்கள் SC Courier மெய்நிகர் உதவிப்பாளர். இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
        faqTitle: "கேள்வி பதில்கள்",
        inputPlaceholder: "செய்தியை தட்டச்சு செய்யவும்...",
        clearConfirm: "இந்த உரையாடலை அழிக்க விரும்புகிறீர்களா?",
        faqs: [
            { text: "🔍 தொகுப்பைக் கண்காணிக்கவும்", query: "தொகுப்பைக் கண்காணிக்கவும்" },
            { text: "💵 கப்பல் கட்டணங்கள்", query: "கப்பல் கட்டணங்கள்" },
            { text: "📝 பதிவு செய்வது எப்படி?", query: "பதிவு செய்வது எப்படி?" },
            { text: "📞 ஆதரவைத் தொடர்பு கொள்ளவும்", query: "ஆதரவைத் தொடர்பு கொள்ளவும்" }
        ]
    }
};

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [language, setLanguage] = useState('EN');
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

    // Dynamically update welcome message if it is the only message in the list
    useEffect(() => {
        if (messages.length === 1 && messages[0].sender === 'bot') {
            setMessages([
                {
                    id: 1,
                    sender: 'bot',
                    text: translations[language].welcome,
                    time: messages[0].time
                }
            ]);
        }
    }, [language]);

    const handleClearChat = () => {
        if (window.confirm(translations[language].clearConfirm)) {
            setMessages([
                {
                    id: 1,
                    sender: 'bot',
                    text: translations[language].welcome,
                    time: getFormattedTime()
                }
            ]);
        }
    };

    // Helper to render simple bold markdown
    const renderMessageContent = (text) => {
        if (!text) return '';
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
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

        // 1. Check for specific tracking numbers (Independent of language)
        const trackingMatch = cleanQuery.match(/sc\d+/i);
        if (trackingMatch) {
            const id = trackingMatch[0].toUpperCase();
            if (language === 'SI') {
                if (id === 'SC101000') {
                    return `📦 **පැකේජ හැඳුනුම්පත: SC101000**\n\n🟢 **තත්ත්වය**: අනුමත කර ඇත / ප්‍රවාහනයේ පවතී\n📍 **ගමනාන්තය**: Seattle, WA\n📅 **ඇණවුම් කළ දිනය**: 2024-02-25\n\nඔබේ පැකේජය දැනට ප්‍රවාහනයේ පවතින අතර නියමිත වේලාවට ලැබෙනු ඇත.`;
                } else if (id === 'SC101015') {
                    return `📦 **පැකේජ හැඳුනුම්පත: SC101015**\n\n🔴 **තත්ත්වය**: භාරදීම ප්‍රතික්ෂේප විය\n📍 **ගමනාන්තය**: Denver, CO\n📅 **ඇණවුම් කළ දිනය**: 2024-03-02\n\nමෙම භාරදීම ප්‍රතික්ෂේප කර ඇති බව සටහන්ව ඇත. වැඩිදුර තොරතුරු සඳහා අපගේ සහාය සේවාව අමතන්න.`;
                } else if (id === 'SC100892' || id === 'SC100865' || id === 'SC100810') {
                    return `📦 **පැකේජ හැඳුනුම්පත: ${id}**\n\n✅ **තත්ත්වය**: සාර්ථකව භාර දෙන ලදී\n📍 **ගමනාන්තය**: ශ්‍රී ලංකාව / එක්සත් ජනපදය\n\nමෙම පැකේජය දැනටමත් ලබන්නා වෙත සාර්ථකව භාර දී ඇත.`;
                } else {
                    return `📦 **පැකේජ හැඳුනුම්පත: ${id}**\n\n🟢 **තත්ත්වය**: ප්‍රවාහනයේ පවතී\n📍 **ස්ථානය**: Distribution Center, NY\n⚡ **ප්‍රගතිය**: 60%\n\nඔබේ පැකේජය ගමනාන්තය වෙත සාර්ථකව ගමන් කරමින් පවතී.`;
                }
            } else if (language === 'TA') {
                if (id === 'SC101000') {
                    return `📦 **தொகுப்பு ஐடி: SC101000**\n\n🟢 **நிலைமை**: அங்கீகரிக்கப்பட்டது / வழியில் உள்ளது\n📍 **சேருமிடம்**: Seattle, WA\n📅 **ஆர்டர் தேதி**: 2024-02-25\n\nஉங்கள் தொகுப்பு தற்போது வழியில் உள்ளது மற்றும் திட்டமிட்டபடி வந்து சேரும்.`;
                } else if (id === 'SC101015') {
                    return `📦 **தொகுப்பு ஐடி: SC101015**\n\n🔴 **நிலைமை**: டெலிவரி மறுக்கப்பட்டது\n📍 **சேருமிடம்**: Denver, CO\n📅 **ஆர்டர் தேதி**: 2024-03-02\n\nஇந்த டெலிவரி மறுக்கப்பட்டுள்ளது. மேலும் தகவலுக்கு எங்கள் ஆதரவு சேவையைத் தொடர்பு கொள்ளவும்.`;
                } else if (id === 'SC100892' || id === 'SC100865' || id === 'SC100810') {
                    return `📦 **தொகுப்பு ஐடி: ${id}**\n\n✅ **நிலைமை**: வெற்றிகரமாக வழங்கப்பட்டது\n📍 **சேருமிடம்**: இலங்கை / அமெரிக்கா\n\nஇந்த தொகுப்பு ஏற்கனவே பெறுநரிடம் வெற்றிகரமாக ஒப்படைக்கப்பட்டுவிட்டது.`;
                } else {
                    return `📦 **தொகுப்பு ஐடி: ${id}**\n\n🟢 **நிலைமை**: வழியில் உள்ளது\n📍 **இருப்பிடம்**: Distribution Center, NY\n⚡ **முன்னேற்றம்**: 60%\n\nஉங்கள் தொகுப்பு சேருமிடத்தை நோக்கி வெற்றிகரமாக சென்று கொண்டிருக்கிறது.`;
                }
            } else {
                if (id === 'SC101000') {
                    return `📦 **Package ID: SC101000**\n\n🟢 **Status**: Approved / In Transit\n📍 **Destination**: Seattle, WA\n📅 **Ordered**: 2024-02-25\n\nYour package is currently in transit and is on schedule.`;
                } else if (id === 'SC101015') {
                    return `📦 **Package ID: SC101015**\n\n🔴 **Status**: Declined on delivery\n📍 **Destination**: Denver, CO\n📅 **Ordered**: 2024-03-02\n\nThis delivery was marked as declined. Please contact our support line for further details.`;
                } else if (id === 'SC100892' || id === 'SC100865' || id === 'SC100810') {
                    return `📦 **Package ID: ${id}**\n\n✅ **Status**: Delivered\n📍 **Destination**: USA\n\nThis package has already been successfully delivered to the recipient.`;
                } else {
                    return `📦 **Package ID: ${id}**\n\n🟢 **Status**: In Transit\n📍 **Location**: Distribution Center, NY\n⚡ **Progress**: 60%\n\nYour package is moving smoothly towards its destination.`;
                }
            }
        }

        // 2. Keyword routing based on language selection
        if (language === 'SI') {
            if (cleanQuery.includes('ලුහු') || cleanQuery.includes('ලැබෙ') || cleanQuery.includes('කෝ') || cleanQuery.includes('track') || cleanQuery.includes('status')) {
                return "පැකේජයක් ලුහුබැඳීමට කරුණාකර **SC** වලින් ආරම්භ වන ඔබගේ ලුහුබැඳීමේ අංකය ඇතුළත් කරන්න (උදාහරණයක් ලෙස: **SC101000** හෝ **SC100892**).";
            }
            if (cleanQuery.includes('ගාස්තු') || cleanQuery.includes('මිල') || cleanQuery.includes('කීයද') || cleanQuery.includes('rates') || cleanQuery.includes('price')) {
                return "💵 **SC Courier නැව්ගත කිරීමේ ගාස්තු:**\n\n• **සාමාන්‍ය දේශීය**: රු. 500.00 (කිලෝග්‍රෑම් 1 දක්වා) + අමතර කිලෝග්‍රෑමයකට රු. 150.00.\n• **වේගවත් දේශීය**: රු. 1200.00 (කිලෝග්‍රෑම් 1 දක්වා) + අමතර කිලෝග්‍රෑමයකට රු. 300.00.\n• **ජාත්‍යන්තර**: රු. 7500.00 සිට ඉහළට (ගමනාන්තය අනුව වෙනස් වේ).\n\nඔබට ගිණුමක් සාදා ලොග් වීමෙන් පසු ඇණවුම් ඉදිරිපත් කළ හැකිය.";
            }
            if (cleanQuery.includes('ලියාපදිංචි') || cleanQuery.includes('ගිණුම') || cleanQuery.includes('හදන්') || cleanQuery.includes('register') || cleanQuery.includes('account')) {
                return "📝 **ලියාපදිංචි වන්නේ කෙසේද:**\n\n1. මුල් පිටුවේ ඇති **'Login to Account'** මත ක්ලික් කරන්න.\n2. **'Register Now'** බොත්තම ක්ලික් කරන්න.\n3. ඔබේ විස්තර (නම, ඊමේල්, ලිපිනය, දුරකථන අංකය, මුරපදය) ඇතුළත් කර **'Create Account'** ක්ලික් කරන්න.";
            }
            if (cleanQuery.includes('දුරකථන') || cleanQuery.includes('ඊමේල්') || cleanQuery.includes('කතා') || cleanQuery.includes('සහාය') || cleanQuery.includes('support') || cleanQuery.includes('contact')) {
                return "📞 **සහාය සේවා සම්බන්ධතා:**\n\n• **දුරකථන**: +94 77 123 4567\n• **ඊමේල්**: support@sccourier.com\n• **ලිපිනය**: 123 Logistics Way, NY 10001\n\nඕනෑම විමසීමක් සඳහා අපගේ පාරිභෝගික සහාය සේවාව 24/7 විවෘතව පවතී.";
            }
            if (cleanQuery.includes('ශාඛා') || cleanQuery.includes('ස්ථානය') || cleanQuery.includes('කොහෙද') || cleanQuery.includes('location') || cleanQuery.includes('branch')) {
                return "📍 අපගේ ප්‍රධාන බෙදාහැරීමේ කාර්යාලය **123 Logistics Way, NY 10001** හි පිහිටා ඇත.";
            }
            if (cleanQuery.includes('atr') || cleanQuery.includes('පෝරමය')) {
                return "📋 **ATR (Activity Travel Request) පෝරමය:**\n\nලියාපදිංචි පාරිභෝගිකයින්ට ඔවුන්ගේ උපකරණ පුවරුවෙන් (Dashboard) **'Deliver Now'** ක්ලික් කිරීමෙන් ATR පෝරමය පුරවා වාහන අවශ්‍යතා සහ ගමන් විස්තර ඉදිරිපත් කළ හැකිය.";
            }
            if (cleanQuery.includes('හෙලෝ') || cleanQuery.includes('හලෝ') || cleanQuery.includes('ආයුබෝවන්') || cleanQuery.includes('hi') || cleanQuery.includes('hello')) {
                return "ආයුබෝවන්! 😊 අද මම ඔබට උදව් කරන්නේ කෙසේද?";
            }
            if (cleanQuery.includes('ස්තූතියි') || cleanQuery.includes('නියමයි') || cleanQuery.includes('thank')) {
                return "ඔබ සාදරයෙන් පිළිගනිමු! ඔබට තවත් සහායක් අවශ්‍ය නම් මට දන්වන්න. 👍";
            }
            return "කණගාටුයි, මට එය පැහැදිලි නැත. 😅 කරුණාකර ඔබේ ප්‍රශ්නය වෙනත් ආකාරයකින් අසන්න. නැතහොත් පහත විකල්ප වලින් එකක් තෝරන්න:\n\n• පැකේජය ලුහුබැඳීමට **SC101000** ටයිප් කරන්න.\n• ගාස්තු දැනගැනීමට **ගාස්තු** ටයිප් කරන්න.\n• සහාය සේවාව සඳහා **සහාය** ටයිප් කරන්න.";
        } else if (language === 'TA') {
            if (cleanQuery.includes('கண்கா') || cleanQuery.includes('எங்கே') || cleanQuery.includes('நிலை') || cleanQuery.includes('track') || cleanQuery.includes('status')) {
                return "தொகுப்பைக் கண்காணிக்க, தயவுசெய்து **SC** இல் தொடங்கும் உங்கள் கண்காணிப்பு எண்ணை உள்ளிடவும் (உதாரணமாக: **SC101000** அல்லது **SC100892**).";
            }
            if (cleanQuery.includes('கட்டண') || cleanQuery.includes('விலை') || cleanQuery.includes('மதிப') || cleanQuery.includes('rates') || cleanQuery.includes('price')) {
                return "💵 **SC Courier கப்பல் கட்டணங்கள்:**\n\n• **சாதாரண உள்நாட்டு**: ரூ. 500.00 (1 கிலோ வரை) + கிலோவிற்கு ரூ. 150.00.\n• **விரைவான உள்நாட்டு**: ரூ. 1200.00 (1 கிலோ வரை) + கிலோவிற்கு ரூ. 300.00.\n• **சர்வதேச**: ரூ. 7500.00 இலிருந்து ஆரம்பம் (நாட்டின் இருப்பிடத்தைப் பொறுத்தது).\n\nபதிவு செய்து உள்நுழைந்த பிறகு நீங்கள் டெலிவரி கோரிக்கைகளை சமர்ப்பிக்கலாம்.";
            }
            if (cleanQuery.includes('பதிவு') || cleanQuery.includes('கணக்கு') || cleanQuery.includes('register') || cleanQuery.includes('account')) {
                return "📝 **பதிவு செய்வது எப்படி:**\n\n1. முகப்புப் பக்கத்தில் **'Login to Account'** என்பதைக் கிளிக் செய்யவும்.\n2. **'Register Now'** பொத்தானைக் கிளிக் செய்யவும்.\n3. உங்கள் விவரங்களை (பெயர், மின்னஞ்சல், முகவரி, தொலைபேசி, கடவுச்சொல்) உள்ளிட்டு **'Create Account'** என்பதைக் கிளிக் செய்யவும்.";
            }
            if (cleanQuery.includes('தொடர்பு') || cleanQuery.includes('தொலை') || cleanQuery.includes('மின்ன') || cleanQuery.includes('ஆதரவு') || cleanQuery.includes('support') || cleanQuery.includes('contact')) {
                return "📞 **ஆதரவு தொடர்பு விவரங்கள்:**\n\n• **தொலைபேசி**: +94 77 123 4567\n• **மின்னஞ்சல்**: support@sccourier.com\n• **முகவரி**: 123 Logistics Way, NY 10001\n\nஎங்கள் வாடிக்கையாளர் ஆதரவு சேவை 24/7 திறந்திருக்கும்.";
            }
            if (cleanQuery.includes('கிளை') || cleanQuery.includes('இடம்') || cleanQuery.includes('எங்கு') || cleanQuery.includes('location') || cleanQuery.includes('branch')) {
                return "📍 எங்கள் முக்கிய விநியோக அலுவலகம் **123 Logistics Way, NY 10001** இல் அமைந்துள்ளது.";
            }
            if (cleanQuery.includes('atr') || cleanQuery.includes('படிவம்')) {
                return "📋 **ATR (Activity Travel Request) படிவம்:**\n\nபதிவுசெய்த வாடிக்கையாளர்கள் தங்கள் டாஷ்போர்டில் **'Deliver Now'** என்பதைக் கிளிக் செய்து, பயணத் தகவல்களை வழங்கலாம்.";
            }
            if (cleanQuery.includes('வணக்கம்') || cleanQuery.includes('ஹலோ') || cleanQuery.includes('hi') || cleanQuery.includes('hello')) {
                return "வணக்கம்! 😊 நான் இன்று உங்களுக்கு எவ்வாறு உதவ முடியும்?";
            }
            if (cleanQuery.includes('நன்றி') || cleanQuery.includes('வாழ்த்து') || cleanQuery.includes('thank')) {
                return "உங்களை வரவேற்பதில் மகிழ்ச்சி! மேலும் உதவி தேவைப்பட்டால் எனக்குத் தெரிவிக்கவும். 👍";
            }
            return "மன்னிக்கவும், எனக்கு அது சரியாகப் புரியவில்லை. 😅 உங்கள் கேள்வியை வேறு விதமாக கேட்கவும். அல்லது கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:\n\n• தொகுப்பைக் கண்காணிக்க **SC101000** என தட்டச்சு செய்யவும்.\n• கட்டணங்களை அறிய **கட்டணங்கள்** என தட்டச்சு செய்யவும்.\n• ஆதரவுக்கு **ஆதரவு** என தட்டச்சு செய்யவும்.";
        } else {
            // English default fallback
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
            return "I'm sorry, I didn't quite catch that. 😅 Could you rephrase your question? Or, you can choose one of the quick options below:\n\n• Type **SC101000** to test package tracking.\n• Type **rates** to view shipping costs.\n• Type **contact** to see our support info.";
        }
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
                                <h4>{translations[language].title}</h4>
                                <div className="chatbot-status">
                                    <span className="chatbot-status-dot"></span>
                                    <span>{translations[language].status}</span>
                                </div>
                            </div>
                        </div>
                        <div className="chatbot-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <select 
                                className="chatbot-lang-select" 
                                value={language} 
                                onChange={(e) => setLanguage(e.target.value)}
                                title="Change Language / භාෂාව වෙනස් කරන්න / மொழியை மாற்றவும்"
                            >
                                <option value="EN">EN</option>
                                <option value="SI">සිංහල (SI)</option>
                                <option value="TA">தமிழ் (TA)</option>
                            </select>
                            <button className="chatbot-clear-btn" onClick={handleClearChat} title={translations[language].clearConfirm}>
                                <i className="bx bx-trash"></i>
                            </button>
                            <button className="chatbot-close-btn" onClick={() => setIsOpen(false)}>
                                <i className="bx bx-x"></i>
                            </button>
                        </div>
                    </div>

                    {/* Messages List */}
                    <div className="chatbot-messages">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`chatbot-msg-wrapper ${msg.sender}`}>
                                <div className="chatbot-msg" style={{ whiteSpace: 'pre-wrap' }}>
                                    {renderMessageContent(msg.text)}
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
                        <div className="chatbot-quick-faqs-title">{translations[language].faqTitle}</div>
                        <div className="chatbot-faq-list">
                            {translations[language].faqs.map((faq, index) => (
                                <button
                                    key={index}
                                    className="chatbot-faq-btn"
                                    onClick={() => handleFaqClick(faq.query)}
                                >
                                    {faq.text}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Input Form */}
                    <form className="chatbot-input-form" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            placeholder={translations[language].inputPlaceholder}
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
