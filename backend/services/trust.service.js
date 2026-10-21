import IdentityModel from "../models/Identity.js";

// Add a DID to the trusted VC issuers list for this gateway.
// role: "localAdmin" | "platformRoot" | "factoryDid"
const addTrustedIssuer = async ({ did, role = "localAdmin" }) => {
    const store = await IdentityModel.findOneAndUpdate(
        { key: "main_store" },
        { $addToSet: { trustedIssuers: { did, role, addedAt: new Date() } } },
        { new: true, upsert: true }
    );
    return store.trustedIssuers;
};

// Returns the list of trusted issuer DIDs (plain strings).
const getTrustedIssuers = async () => {
    const store = await IdentityModel.findOne({ key: "main_store" });
    return (store?.trustedIssuers || []).map(i => i.did);
};

// Returns full trusted issuer objects (did + role + addedAt).
const getTrustedIssuersDetail = async () => {
    const store = await IdentityModel.findOne({ key: "main_store" });
    return store?.trustedIssuers || [];
};

// Returns true if issuerDid is in the trusted list.
// If the list is empty, returns true (backward-compat: trust any valid signature).
const isIssuerTrusted = async (issuerDid) => {
    const issuers = await getTrustedIssuers();
    if (issuers.length === 0) return true;   // no restriction configured yet
    return issuers.includes(issuerDid);
};

export { addTrustedIssuer, getTrustedIssuers, getTrustedIssuersDetail, isIssuerTrusted };
