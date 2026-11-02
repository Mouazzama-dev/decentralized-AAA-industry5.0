import IdentityModel from "../models/Identity.js";
import { agent } from "../../agent.js";

// C4: resolve a DID and store its DID document in MongoDB for offline verification.
// Called automatically when a platformRoot trusted issuer is added.
const cacheDidDocument = async (did) => {
    const result = await agent.resolveDid({ didUrl: did });
    const document = result.didDocument;
    if (!document) throw new Error(`resolveDid returned no document for ${did}`);

    // Two-step: remove stale entry, then push fresh one
    await IdentityModel.findOneAndUpdate(
        { key: "main_store" },
        { $pull: { cachedDIDDocuments: { did } } },
        { upsert: true }
    );
    await IdentityModel.findOneAndUpdate(
        { key: "main_store" },
        { $push: { cachedDIDDocuments: { did, document, cachedAt: new Date() } } },
        { new: true, upsert: true }
    );
    return document;
};

// Return the cached DID document for a given DID, or null if not cached.
// Uses .lean() so the returned document is a plain JS object (not a Mongoose proxy).
const getCachedDIDDocument = async (did) => {
    const store = await IdentityModel.findOne({ key: "main_store" }).lean();
    const entry = (store?.cachedDIDDocuments || []).find(d => d.did === did);
    return entry?.document || null;
};

// C4: list all cached DID document entries (did + cachedAt).
const listCachedDIDDocuments = async () => {
    const store = await IdentityModel.findOne({ key: "main_store" }).lean();
    return (store?.cachedDIDDocuments || []).map(d => ({
        did: d.did,
        cachedAt: d.cachedAt
    }));
};

// Add a DID to the trusted VC issuers list for this gateway.
// role: "localAdmin" | "platformRoot" | "factoryDid"
// C4: if role is "platformRoot", also caches the DID document for offline verification.
const addTrustedIssuer = async ({ did, role = "localAdmin" }) => {
    const store = await IdentityModel.findOneAndUpdate(
        { key: "main_store" },
        { $addToSet: { trustedIssuers: { did, role, addedAt: new Date() } } },
        { new: true, upsert: true }
    );

    if (role === "platformRoot") {
        try {
            await cacheDidDocument(did);
            console.log(`[C4] Cached DID document for Platform Root: ${did}`);
        } catch (err) {
            console.warn(`[C4] Could not cache DID document for ${did}: ${err.message}`);
        }
    }

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

export {
    addTrustedIssuer,
    getTrustedIssuers,
    getTrustedIssuersDetail,
    isIssuerTrusted,
    cacheDidDocument,
    getCachedDIDDocument,
    listCachedDIDDocuments
};
