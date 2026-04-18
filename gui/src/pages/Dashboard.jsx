import React, { useState, useEffect } from 'react';
import { getIdentities, checkAccess, executeAction } from '../api';
import { Play, ShieldAlert, Terminal } from 'lucide-react';
import '../styles/dashboard.css';

const Dashboard = () => {
    const [operators, setOperators] = useState([]);
    const [devices, setDevices] = useState([]);
    const [selectedOp, setSelectedOp] = useState('');
    const [selectedDev, setSelectedDev] = useState('');
    const [selectedAction, setSelectedAction] = useState('SWITCH_ON');
    const [isVerified, setIsVerified] = useState(false);
    const [loading, setLoading] = useState(false);

    const [logs, setLogs] = useState([
        { time: new Date().toLocaleTimeString(), msg: "System Ready..." }
    ]);

    // ==========================
    // LOAD IDENTITIES
    // ==========================
    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await getIdentities();
                setOperators(data.filter(i => i.type === 'operator'));
                setDevices(data.filter(i => i.type === 'device'));
            } catch (e) {
                console.error(e);
            }
        };
        load();
    }, []);

    const addLog = (msg) => {
        setLogs(prev => [
            { time: new Date().toLocaleTimeString(), msg },
            ...prev
        ]);
    };

    // ==========================
    // 🔐 VERIFY ACCESS
    // ==========================
    const handleVerifyAccess = async () => {
        if (!selectedOp || !selectedDev) return;

        setLoading(true);
        addLog("🔍 Verifying access...");

        try {
            const res = await checkAccess({
                operatorDid: selectedOp,
                deviceDid: selectedDev,
                action: selectedAction
            });

            if (res.data.success) {
                setIsVerified(true);
                addLog("✅ ACCESS GRANTED");
                addLog("🔓 Machine UNLOCKED");
            } else {
                setIsVerified(false);

                if (res.data.reason === "NO_PERMIT") {
                    addLog("❌ NO PERMIT");
                }

                if (res.data.reason === "INVALID_ACTION") {
                    addLog("🚫 ACTION NOT ALLOWED");
                }
            }

        } catch (err) {
            console.error(err);
            addLog("❌ Verification Error");
        } finally {
            setLoading(false);
        }
    };

    // ==========================
    // 🚀 REAL EXECUTION (BACKEND)
    // ==========================
    const handleExecute = async () => {
        if (!selectedOp || !selectedDev) return;

        setLoading(true);
        addLog(`🚀 Executing ${selectedAction}...`);

        try {
            const res = await executeAction({
                operatorDid: selectedOp,
                deviceDid: selectedDev,
                action: selectedAction
            });

            if (res.data.success) {
                addLog("⚙️ Machine Response OK");
                addLog("📊 Logged Locally");
                addLog("🔗 Queued for Blockchain");
                addLog("✅ Completed");
            } else {
                if (res.data.reason === "NO_PERMIT") {
                    addLog("❌ EXECUTION FAILED (No Permit)");
                }

                if (res.data.reason === "INVALID_ACTION") {
                    addLog("🚫 EXECUTION BLOCKED");
                }

                setIsVerified(false);
            }

        } catch (err) {
            console.error(err);
            addLog("❌ Execution Error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ops-container">
            <div className="grid grid-cols-12 gap-8">

                {/* LEFT PANEL */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="machine-card">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <ShieldAlert className="text-accent" /> Authentication
                        </h2>

                        {/* OPERATOR */}
                        <select
                            className="select-box mb-4"
                            onChange={(e) => {
                                setSelectedOp(e.target.value);
                                setIsVerified(false);
                            }}
                        >
                            <option value="">Select Operator</option>
                            {operators.map(op => (
                                <option key={op.did} value={op.did}>
                                    {op.alias}
                                </option>
                            ))}
                        </select>

                        {/* DEVICE */}
                        <select
                            className="select-box mb-4"
                            onChange={(e) => {
                                setSelectedDev(e.target.value);
                                setIsVerified(false);
                            }}
                        >
                            <option value="">Select Device</option>
                            {devices.map(dev => (
                                <option key={dev.did} value={dev.did}>
                                    {dev.alias}
                                </option>
                            ))}
                        </select>

                        {/* ACTION */}
                        <select
                            className="select-box mb-6"
                            value={selectedAction}
                            onChange={(e) => setSelectedAction(e.target.value)}
                        >
                            <option value="SWITCH_ON">SWITCH ON</option>
                            <option value="SWITCH_OFF">SWITCH OFF</option>
                            <option value="MOVE_UP">MOVE UP</option>
                            <option value="MOVE_DOWN">MOVE DOWN</option>
                        </select>

                        {!isVerified ? (
                            <button
                                onClick={handleVerifyAccess}
                                disabled={loading}
                                className="execute-btn"
                            >
                                {loading ? "VERIFYING..." : "VERIFY"}
                            </button>
                        ) : (
                            <button
                                onClick={handleExecute}
                                disabled={loading}
                                className="execute-btn btn-ready"
                            >
                                <Play size={18} />
                                {loading ? "EXECUTING..." : "EXECUTE"}
                            </button>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="machine-card h-full">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Terminal className="text-accent" /> Logs
                        </h2>

                        <div className="log-window">
                            {logs.map((log, i) => (
                                <div key={i} className="mb-2 flex gap-4">
                                    <span className="text-gray-600">[{log.time}]</span>
                                    <span
                                        className={
                                            log.msg.includes('❌') ? 'text-red-400' :
                                            log.msg.includes('🚫') ? 'text-yellow-400' :
                                            log.msg.includes('✅') ? 'text-green-400' :
                                            'text-gray-300'
                                        }
                                    >
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