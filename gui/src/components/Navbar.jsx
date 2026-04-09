import React from 'react';
import { LayoutDashboard, UserPlus, ShieldCheck, Activity } from 'lucide-react';

const Navbar = ({ activePage, setActivePage }) => {
  const navItems = [
    { id: 'registration', label: 'Identity Hub', icon: <UserPlus size={18} /> },
    { id: 'issuance', label: 'Access Control', icon: <ShieldCheck size={18} /> },
    { id: 'dashboard', label: 'Live Operations', icon: <Activity size={18} /> },
  ];

  return (
    <nav className="bg-[#0D0D0E] border-b border-gray-800 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="bg-accent p-1.5 rounded-lg">
          <LayoutDashboard className="text-black" size={20} />
        </div>
        <span className="font-bold text-xl tracking-tighter text-white">Smart Factory</span>
      </div>

      <div className="flex gap-6">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium ${
              activePage === item.id 
                ? 'bg-accent/10 text-accent border border-accent/20' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Sepolia Node: Connected</span>
      </div>
    </nav>
  );
};

export default Navbar;