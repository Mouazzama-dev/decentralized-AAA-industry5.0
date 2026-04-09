import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Registration from './pages/Registration';
import Issuance from './pages/Issuance';
import Dashboard from './pages/Dashboard';

function App() {
  const [activePage, setActivePage] = useState('registration');

  // Page switching logic
  const renderPage = () => {
    switch(activePage) {
      case 'registration': return <Registration />;
      case 'issuance':     return <Issuance />;
      case 'dashboard':    return <Dashboard />;
      default:             return <Registration />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <Navbar activePage={activePage} setActivePage={setActivePage} />
      <main className="transition-all duration-300">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;