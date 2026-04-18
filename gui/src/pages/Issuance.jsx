import React, { useState, useEffect } from 'react';
import { getIdentities, issuePermit } from '../api';
import { ShieldCheck, Lock, Wallet } from 'lucide-react';
import '../styles/issuance.css';

const Issuance = () => {
    const [operators, setOperators] = useState([]);
    const [devices, setDevices] = useState([]);
    const [selectedOp, setSelectedOp] = useState('');
    const [selectedDev, setSelectedDev] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // 🔥 NEW STATES
    const [userAddress, setUserAddress] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    const ADMIN_WALLET_ADDRESS = "0x5d1a7e1b7dc23d2e1f677e1ed919fb501d36205e";

    // 🔌 CONNECT WALLET
    const connectWallet = async () => {
        if (window.ethereum) {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            setUserAddress(accounts[0].toLowerCase());
        } else {
            alert("Install MetaMask");
        }
    };

    // 🔐 ADMIN CHECK
    useEffect(() => {
        if (userAddress) {
            setIsAdmin(userAddress === ADMIN_WALLET_ADDRESS);
        }
    }, [userAddress]);

    // 🔄 LOAD IDENTITIES
    useEffect(() => {
        const load = async () => {
            const { data } = await getIdentities();

            const activeOps = data.filter(i => i.type === 'operator' && i.status === 'ACTIVE');
            const activeDevs = data.filter(i => i.type === 'device' && i.status === 'ACTIVE');

            setOperators(activeOps);
            setDevices(activeDevs);
        };

        load();

        // 🔥 AUTO LOAD WALLET IF ALREADY CONNECTED
        if (window.ethereum) {
            window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
                if (accounts.length > 0) {
                    setUserAddress(accounts[0].toLowerCase());
                }
            });
        }

    }, []);

    // 🎯 ISSUE VC
    const handleIssue = async () => {
        if (!isAdmin) {
            return alert("Only admin can grant access!");
        }

        if (!selectedOp || !selectedDev) {
            return alert("Select both Operator and Machine");
        }

        setLoading(true);

        try {
            const response = await issuePermit({
                operatorDid: selectedOp,
                deviceDid: selectedDev,
                address: userAddress   // ✅ NOW WORKING
            });

            console.log("VC Issued:", response.data);

            setSuccess(true);
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

            {/* HEADER */}
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Access Control Center</h1>
                    <p className="text-gray-500 text-sm">
                        Authorize operators to interact with industrial assets
                    </p>
                </div>

                {/* WALLET BUTTON */}
                <button
                    onClick={connectWallet}
                    className={`flex items-center gap-2 px-4 py-2 rounded border ${
                        isAdmin ? 'text-green-400 border-green-400' : 'text-gray-400 border-gray-600'
                    }`}
                >
                    <Wallet size={16} />
                    {userAddress
                        ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)} ${isAdmin ? '(ADMIN)' : ''}`
                        : 'Connect Wallet'}
                </button>
            </header>

            <div className="max-w-2xl mx-auto">
                <div className="permit-form">

                    {/* SELECTORS */}
                    <div className="grid grid-cols-2 gap-8 mb-8">

                        <div>
                            <label className="text-xs text-gray-500 mb-2 block">
                                Operator
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

                        <div>
                            <label className="text-xs text-gray-500 mb-2 block">
                                Machine
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
                    <div className="bg-black/40 border border-gray-800 p-6 rounded-xl mb-6">
                        <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                            <Lock size={16} /> Default Permissions
                        </h4>

                        <div className="flex gap-2">
                            <span className="action-chip action-chip-active">EXECUTE</span>
                            <span className="action-chip action-chip-active">READ_SENSORS</span>
                        </div>
                    </div>

                    {/* BUTTON */}
                    {isAdmin && (
                        <button
                            onClick={handleIssue}
                            disabled={loading}
                            className="reg-btn w-full py-4"
                        >
                            {loading ? "SIGNING..." : "GRANT ACCESS"}
                        </button>
                    )}

                    {!isAdmin && (
                        <p className="text-center text-yellow-500 text-sm mt-4">
                            Only admin can grant access
                        </p>
                    )}

                    {/* SUCCESS */}
                    {success && (
                        <div className="mt-4 text-green-400 text-center">
                            ✅ Access granted successfully!
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default Issuance;