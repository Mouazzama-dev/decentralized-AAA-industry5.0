import React, { useState, useEffect } from 'react';
import { UserPlus, Fingerprint, Cpu, CheckCircle, Wallet, ShieldCheck } from 'lucide-react';
import '../styles/registration.css';
import { getIdentities, registerDID, activateDID, deactivateDID } from '../api';

const Registration = () => {
    const [alias, setAlias] = useState('');
    const [type, setType] = useState('operator');
    const [loading, setLoading] = useState(false);
    const [registry, setRegistry] = useState([]);
    const [userAddress, setUserAddress] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    const ADMIN_WALLET_ADDRESS = "0x5d1a7e1b7dc23d2e1f677e1ed919fb501d36205e";

    // 🔌 CONNECT WALLET
    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                setUserAddress(accounts[0].toLowerCase());
            } catch {
                console.error("Wallet connection denied");
            }
        } else {
            alert("Please install MetaMask!");
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
        loadIdentities();

        if (window.ethereum) {
            window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
                if (accounts.length > 0) {
                    setUserAddress(accounts[0].toLowerCase());
                }
            });
        }
    }, []);

    const loadIdentities = async () => {
        try {
            const { data } = await getIdentities();
            setRegistry([...data].reverse()); // latest on top
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    // 📝 REGISTER DID
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!alias.trim()) {
            alert("Alias required");
            return;
        }

        setLoading(true);

        try {
            await registerDID({
                alias: alias.trim(),
                type
            });

            setAlias('');
            await loadIdentities();

        } catch (err) {
            console.error(err);
            alert("Registration Failed!");
        } finally {
            setLoading(false);
        }
    };

    // ✅ ACTIVATE (ADMIN ONLY + SECURE)
    const handleActivate = async (did) => {
        if (!isAdmin) {
            alert("Only admin can activate!");
            return;
        }

        try {
            await activateDID({
                did,
                address: userAddress // 🔥 important for backend security
            });

            await loadIdentities();
        } catch {
            alert("Activation Failed!");
        }
    };

    const handleDeactivate = async (did) => {
    if (!isAdmin) {
        alert("Only admin can deactivate!");
        return;
    }

    try {
        await deactivateDID({
            did,
            address: userAddress
        });

        await loadIdentities();
    } catch {
        alert("Deactivation Failed!");
    }
};

    return (
        <div className="reg-container">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-accent">ID-HUB: Foundation</h1>
                    <p className="text-gray-500 italic text-sm">
                        Self-Sovereign Identity for Industrial IoT
                    </p>
                </div>

                {/* WALLET */}
                <button
                    onClick={connectWallet}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 font-bold ${
                        isAdmin 
                        ? 'border-accent text-accent bg-accent/10' 
                        : userAddress 
                        ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                        : 'border-gray-800 text-gray-400'
                    }`}
                >
                    <Wallet size={18} />
                    {userAddress
                        ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)} ${isAdmin ? '(ADMIN)' : '(GUEST)'}`
                        : 'Connect Wallet'}
                </button>
            </header>

            <div className="grid grid-cols-12 gap-8">

                {/* LEFT */}
                <div className="col-span-12 lg:col-span-4">
                    <div className="reg-card border-t-2 border-accent/20">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <UserPlus className="text-accent" /> Register Asset
                        </h2>

                        <form onSubmit={handleSubmit}>
                            <div className="mb-6">
                                <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">
                                    {type === 'operator' ? 'Operator Name' : 'Machine Name'}
                                </label>

                                <input
                                    className="reg-input focus:border-accent"
                                    placeholder={
                                        type === 'operator'
                                            ? 'Type operator name'
                                            : 'Type machine name'
                                    }
                                    value={alias}
                                    onChange={(e) => setAlias(e.target.value)}
                                />
                            </div>

                            {/* TYPE BUTTONS */}
                            <div className="flex gap-3 mb-6">
                                <button
                                    type="button"
                                    onClick={() => setType('operator')}
                                    className={`type-tab flex-1 ${type === 'operator' ? 'type-tab-active' : 'type-tab-inactive'}`}
                                >
                                    <Fingerprint size={16} /> Human
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setType('device')}
                                    className={`type-tab flex-1 ${type === 'device' ? 'type-tab-active' : 'type-tab-inactive'}`}
                                >
                                    <Cpu size={16} /> Machine
                                </button>
                            </div>

                            <button disabled={loading} className="reg-btn w-full shadow-lg">
                                {loading ? "RECORDING..." : "GENERATE DID"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* RIGHT */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="reg-card border-t-2 border-gray-800">
                        <div className="flex justify-between mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-200">
                                <ShieldCheck className="text-accent" /> Identity Ledger
                            </h2>

                            {isAdmin && (
                                <span className="text-[10px] bg-accent/20 text-accent px-2 py-1 rounded font-bold border">
                                    ADMIN MODE
                                </span>
                            )}
                        </div>

                        <div className="space-y-4">
                            {registry.length === 0 && (
                                <p className="text-gray-600 text-center py-10 italic">
                                    Awaiting first entry...
                                </p>
                            )}

                            {registry.map((id, index) => (
                                <div key={index} className="bg-black/40 border border-gray-800 p-5 rounded-2xl flex justify-between">

                                    <div className="flex items-center gap-5">
                                        <div className={`p-3 rounded-full ${id.status === 'ACTIVE' ? 'bg-accent/10 text-accent' : 'bg-gray-900 text-gray-600'}`}>
                                            {id.type === 'operator'
                                                ? <Fingerprint size={28} />
                                                : <Cpu size={28} />}
                                        </div>

                                        <div>
                                            <p className="font-bold text-white">{id.alias}</p>
                                            <p className="text-[10px] text-gray-500">{id.did}</p>
                                        </div>
                                    </div>

                                  <div className="flex items-center gap-2">

    {/* PENDING */}
    {id.status === 'PENDING' && (
        isAdmin ? (
            <button
                onClick={() => handleActivate(id.did)}
                className="bg-accent text-black text-[10px] px-4 py-2 rounded-lg"
            >
                APPROVE
            </button>
        ) : (
            <span className="text-yellow-500 text-xs">
                Awaiting Approval
            </span>
        )
    )}

    {/* ACTIVE */}
    {id.status === 'ACTIVE' && (
        <>
            <div className="flex items-center gap-2 text-accent">
                <CheckCircle size={14} />
                <span className="text-xs font-bold">ACTIVE</span>
            </div>

            {isAdmin && (
                <button
                    onClick={() => handleDeactivate(id.did)}
                    className="ml-3 text-red-400 text-[10px] border border-red-400 px-3 py-1 rounded hover:bg-red-400 hover:text-black transition"
                >
                    DEACTIVATE
                </button>
            )}
        </>
    )}

    {/* INACTIVE */}
    {id.status === 'INACTIVE' && (
        <span className="text-red-500 text-xs font-bold">
            INACTIVE
        </span>
    )}

</div>

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