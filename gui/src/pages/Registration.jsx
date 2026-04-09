import React, { useState, useEffect } from 'react';
import { getIdentities, registerDID } from '../api';
import { UserPlus, Fingerprint, Cpu, CheckCircle } from 'lucide-react';
import '../styles/registration.css';

const Registration = () => {
    const [alias, setAlias] = useState('');
    const [type, setType] = useState('operator');
    const [loading, setLoading] = useState(false);
    const [registry, setRegistry] = useState([]);

    // Page load hote hi purane DIDs fetch karein
    useEffect(() => {
        loadIdentities();
    }, []);

    const loadIdentities = async () => {
        try {
            const { data } = await getIdentities();
            setRegistry(data);
        } catch (err) { console.error("Fetch error:", err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!alias) return;
        setLoading(true);
        try {
            await registerDID({ alias, type });
            setAlias('');
            await loadIdentities(); // Refresh list
        } catch (err) {
            alert("Registration Failed!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="reg-container">
            <header className="mb-10">
                <h1 className="text-3xl font-bold text-accent">ID-HUB: Foundation</h1>
                <p className="text-gray-500">Register operators and devices to the factory ledger</p>
            </header>

            <div className="grid grid-cols-12 gap-8">
                {/* Form Section */}
                <div className="col-span-12 lg:col-span-5">
                    <div className="reg-card">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <UserPlus className="text-accent" /> New Identity
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <label className="text-xs text-gray-400 uppercase mb-2 block">Identity Alias</label>
                            <input 
                                className="reg-input"
                                placeholder="e.g. welding-robot-01"
                                value={alias}
                                onChange={(e) => setAlias(e.target.value)}
                            />

                            <div className="flex gap-4 mb-4">
                                <button 
                                    type="button"
                                    onClick={() => setType('operator')}
                                    className={`type-tab ${type === 'operator' ? 'type-tab-active' : 'type-tab-inactive'}`}
                                >
                                    <Fingerprint size={18} /> Operator
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setType('device')}
                                    className={`type-tab ${type === 'device' ? 'type-tab-active' : 'type-tab-inactive'}`}
                                >
                                    <Cpu size={18} /> Machine
                                </button>
                            </div>

                            <button disabled={loading} className="reg-btn">
                                {loading ? "RECORDING..." : "GENERATE DID"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Registry View Section */}
                <div className="col-span-12 lg:col-span-7">
                    <div className="reg-card">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-300">
                            <CheckCircle className="text-accent" size={20} /> Verified Registry
                        </h2>
                        <div className="space-y-4">
                            {registry.length === 0 && <p className="text-gray-600 text-center py-10">No identities found.</p>}
                            {registry.map((id, index) => (
                                <div key={index} className="bg-black/50 border border-gray-800 p-4 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={id.type === 'operator' ? 'text-blue-400' : 'text-purple-400'}>
                                            {id.type === 'operator' ? <Fingerprint size={24} /> : <Cpu size={24} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-200">{id.alias}</p>
                                            <p className="text-[10px] font-mono text-gray-500">{id.did}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] bg-green-900/20 text-green-500 px-2 py-1 rounded">ACTIVE</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Registration;