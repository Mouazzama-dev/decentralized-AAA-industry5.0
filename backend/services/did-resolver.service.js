import { agent } from "../../agent.js";
import IdentityModel from "../models/Identity.js";

/**
 * Resolves an operator DID using a two-step strategy:
 *
 *   1. Local MongoDB store (fast path, no RPC call required).
 *   2. ERC-1056 on-chain resolution via the Veramo agent (cross-factory
 *      fallback — any did:ethr:sepolia DID created by any gateway is
 *      publicly resolvable on Sepolia without a shared database).
 *
 * Machine DIDs always use local-only resolution — this function is
 * intentionally for operator DIDs only. The design rationale is in the
 * Multi-Factory AAA Design Plan (Challenge 1, Option B).
 *
 * @param {string} did   A did:ethr:sepolia DID
 * @returns {{ active: boolean, source: 'local'|'chain'|'none' }}
 */
const resolveOperatorDid = async (did) => {

    // ── Fast path: local MongoDB store ──────────────────────────────────
    const store = await IdentityModel.findOne({ key: "main_store" });

    if (store?.operators.some(o => o.did === did)) {
        return { active: true, source: "local" };
    }

    // ── Fallback: ERC-1056 on-chain resolution ───────────────────────────
    // The Veramo agent resolves did:ethr:sepolia DIDs via the ERC-1056
    // registry at 0x03d5003bf0e79C5F5223588F347ebA39AfbC3818 (Sepolia).
    // A DID that was created by *any* gateway (Factory A, B, …) is already
    // on-chain and verifiable here without any cross-factory database sync.
    try {
        const result = await agent.resolveDid({ didUrl: did });
        const doc = result?.didDocument;

        if (doc && !result.didDocumentMetadata?.deactivated) {
            return { active: true, source: "chain" };
        }
    } catch {
        // RPC unreachable or the DID does not exist on-chain at all.
        // Fall through to the "none" return below.
    }

    return { active: false, source: "none" };
};

export { resolveOperatorDid };
