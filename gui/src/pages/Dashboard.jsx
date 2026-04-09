import React, { useState, useEffect } from 'react';
import { getIdentities } from '../api';
import { Play, ShieldAlert, Terminal, Activity, Cpu } from 'lucide-react';
import '../styles/dashboard.css';

const Dashboard = () => {
    const [operators, setOperators] = useState([]);
    const [devices, setDevices] = useState([]);
    const [selectedOp, setSelectedOp] = useState('');
    const [selectedDev, setSelectedDev] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    const [logs, setLogs] = useState([{ time: new Date().toLocaleTimeString(), msg: "System Ready. Awaiting Authentication..." }]);

    useEffect(() => {
        const load = async () => {
            const { data } = await getIdentities();
            setOperators(data.filter(i => i.type === 'operator'));
            setDevices(data.filter(i => i.type === 'device'));
        };
        load();
    }, []);

    const addLog = (msg) => {
        setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg }, ...prev]);
    };

    const handleVerifyAccess = () => {
        if (!selectedOp || !selectedDev) return;
        
        addLog(`Verifying DID: ${selectedOp.slice(0, 20)}...`);
        
        // Mocking VC Verification logic
        setTimeout(() => {
            setIsVerified(true);
            addLog("✅ Access Granted: Valid Verifiable Credential found.");
            addLog(`Resource ${selectedDev.slice(0, 15)} is now UNLOCKED.`);
        }, 1500);
    };

    const handleExecute = () => {
        addLog("🚀 COMMAND SENT: Starting Industrial Sequence...");
        setTimeout(() => addLog("⚙️ Machine Calibration: OK"), 800);
        setTimeout(() => addLog("🔥 Operation in Progress: 45%"), 1600);
        setTimeout(() => addLog("✅ Task Completed Successfully"), 2500);
    };

    return (
        <div className="ops-container">
            <div className="grid grid-cols-12 gap-8">
                
                {/* Control Panel */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="machine-card">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <ShieldAlert className="text-accent" /> Authentication
                        </h2>
                        <select className="select-box mb-4 bg-black border border-gray-700 w-full p-3 rounded-lg" 
                                onChange={(e) => {setSelectedOp(e.target.value); setIsVerified(false);}}>
                            <option value="">I am Operator...</option>
                            {operators.map(op => <option key={op.did} value={op.did}>{op.alias}</option>)}
                        </select>

                        <select className="select-box mb-6 bg-black border border-gray-700 w-full p-3 rounded-lg" 
                                onChange={(e) => {setSelectedDev(e.target.value); setIsVerified(false);}}>
                            <option value="">Accessing Device...</option>
                            {devices.map(dev => <option key={dev.did} value={dev.did}>{dev.alias}</option>)}
                        </select>

                        {!isVerified ? (
                            <button onClick={handleVerifyAccess} className="execute-btn bg-white text-black hover:bg-gray-200">
                                VERIFY PERMIT
                            </button>
                        ) : (
                            <button onClick={handleExecute} className="execute-btn btn-ready">
                                <Play size={18} /> EXECUTE COMMAND
                            </button>
                        )}
                    </div>

                    <div className="machine-card">
                        <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2">
                            <Activity size={16} /> LIVE TELEMETRY
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs"><span>Load</span><span className="text-accent">12%</span></div>
                            <div className="w-full bg-gray-800 h-1 rounded-full"><div className="bg-accent w-1/4 h-full rounded-full"></div></div>
                            <div className="flex justify-between text-xs"><span>Temp</span><span className="text-orange-500">42°C</span></div>
                        </div>
                    </div>
                </div>

                {/* System Logs Window */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="machine-card h-full">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Terminal className="text-accent" /> Audit Logs (Immutable)
                        </h2>
                        <div className="log-window">
                            {logs.map((log, i) => (
                                <div key={i} className="mb-2 flex gap-4 border-b border-gray-900 pb-2">
                                    <span className="text-gray-600">[{log.time}]</span>
                                    <span className={log.msg.includes('✅') ? 'text-accent' : 'text-gray-300'}>
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;