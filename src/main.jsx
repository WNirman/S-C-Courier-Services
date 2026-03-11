import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AtrForm from './AtrForm.jsx'
import './index.css'

function Root() {
    const [page, setPage] = useState('home');
    if (page === 'atr') return <AtrForm onBack={() => setPage('home')} />;
    return <App onNavigate={(p) => setPage(p)} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>,
)
