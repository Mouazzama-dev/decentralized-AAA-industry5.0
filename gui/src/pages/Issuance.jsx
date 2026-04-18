import React, { useState, useEffect } from 'react';
import { getIdentities, issuePermit } from '../api';
import { ShieldCheck, Lock } from 'lucide-react';
import '../styles/issuance.css';

const Issuance = () => {
    const [operators, setOperators] = useState([]);
    const [devices, setDevices] = useState([]);
    const [selectedOp, setSelectedOp] = useState('');
    const [selectedDev, setSelectedDev] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // 🔄 LOAD ONLY ACTIVE IDENTITIES
    useEffect(() => {
        const load = async () => {
            const { data } = await getIdentities();

            const activeOps = data.filter(i => i.type === 'operator' && i.status === 'ACTIVE');
            const activeDevs = data.filter(i => i.type === 'device' && i.status === 'ACTIVE');

            setOperators(activeOps);
            setDevices(activeDevs);
        };
        load();
    }, []);

    // 🎯 ISSUE VC
    const handleIssue = async () => {
        if (!selectedOp || !selectedDev) {
            return alert("Select both Operator and Machine");
        }

        setLoading(true);

        try {
            const response = await issuePermit({
                operatorDid: selectedOp,
                deviceDid: selectedDev
            });

            console.log("VC Issued:", response.data);

            setSuccess(true);

            // Reset
            setSelectedOp('');
            setSelectedDev('');

            setTimeout(() => setSuccess(false), 3000);

        } catch (err) {
            console.error(err);
            alert("Issuance Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="issuance-container">
            <header className="mb-10 text-center">
                <ShieldCheck className="mx-auto text-accent mb-4" size={48} />
                <h1 className="text-3xl font-bold">Access Control Center</h1>
                <p className="text-gray-500 text-sm">
                    Authorize operators to interact with industrial assets
                </p>
            </header>

            <div className="max-w-2xl mx-auto">
                <div className="permit-form">

                    {/* SELECTORS */}
                    <div className="grid grid-cols-2 gap-8 items-center mb-8">

                        {/* OPERATOR */}
                        <div>
                            <label className="text-xs text-gray-500 uppercase block mb-3">
                                Operator (Subject)
                            </label>

                            <select
                                className="select-box"
                                value={selectedOp}
                                onChange={(e) => setSelectedOp(e.target.value)}
                            >
                                <option value="">Select Operator</option>
                                {operators.map(op => (
                                    <option key={op.did} value={op.did}>
                                        {op.alias}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* DEVICE */}
                        <div>
                            <label className="text-xs text-gray-500 uppercase block mb-3">
                                Machine (Resource)
                            </label>

                            <select
                                className="select-box"
                                value={selectedDev}
                                onChange={(e) => setSelectedDev(e.target.value)}
                            >
                                <option value="">Select Machine</option>
                                {devices.map(dev => (
                                    <option key={dev.did} value={dev.did}>
                                        {dev.alias}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* PERMISSIONS */}
                    <div className="bg-black/40 border border-gray-800 p-6 rounded-xl mb-8">
                        <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                            <Lock size={16} className="text-gray-500" />
                            Default Permissions
                        </h4>

                        <div className="flex flex-wrap gap-2">
                            <span className="action-chip action-chip-active">EXECUTE</span>
                            <span className="action-chip action-chip-active">READ_SENSORS</span>
                            <span className="action-chip opacity-50">ADMIN_BYPASS</span>
                        </div>
                    </div>

                    {/* BUTTON */}
                    <button
                        onClick={handleIssue}
                        disabled={loading}
                        className="reg-btn w-full flex items-center justify-center gap-3 py-5"
                    >
                        {loading
                            ? "SIGNING CREDENTIAL..."
                            : <>GRANT VERIFIABLE ACCESS <ShieldCheck size={20} /></>
                        }
                    </button>

                    {/* SUCCESS */}
                    {success && (
                        <div className="mt-6 p-4 bg-green-900/20 border border-green-800 rounded-lg text-green-400 text-center text-sm">
                            🎉 Access granted successfully!
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default Issuance;