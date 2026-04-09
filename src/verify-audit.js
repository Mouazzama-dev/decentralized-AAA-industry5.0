import * as dotenv from 'dotenv';
import fs from 'fs';
import { ethers } from 'ethers';

dotenv.config();

// --- CONFIGURATION ---
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const CONTRACT_ADDRESS = "0x5b23fFb4956E20dC719b4d09c48829871aD244C3"; 

const ABI = [
    "function logBatch(string,string,uint8[]) public",
    "event BatchLogged(string operatorDid, string deviceDid, uint8[] actionCodes, uint256 timestamp)"
];

// MUST MATCH the ACTION_MAP in operator-session.js
const REVERSE_ACTION_MAP = {
    0: "MOVE_UP",
    1: "MOVE_DOWN",
    2: "SWITCH_ON",
    3: "SWITCH_OFF",
    4: "ROTATE",
    5: "CUT"
};

async function verifyAuditTrail(logFileName) {
    console.log(`\n🔍 Starting Audit Verification for: ${logFileName}...`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    try {
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = latestBlock - 15000; // Scanning last 15,000 blocks

        console.log(`⛓️  Scanning Sepolia...`);

        const filter = contract.filters.BatchLogged();
        const events = await contract.queryFilter(filter, fromBlock, latestBlock);

        if (events.length === 0) {
            console.log("❓ No batches found on-chain for the recent blocks.");
            return;
        }

        if (!fs.existsSync(logFileName)) {
            console.log(`❌ Error: ${logFileName} not found!`);
            return;
        }
        
        const localLogs = fs.readFileSync(logFileName, 'utf8')
                            .split('\n')
                            .filter(line => line.trim() !== "");

        let totalMatches = 0;
        let totalMismatches = 0;

        // Hum sirf wahi batches check karenge jo is log file se match karte hon
        events.forEach((event, batchIndex) => {
            const { actionCodes, operatorDid, deviceDid } = event.args;
            
            console.log(`\n📦 Blockchain Batch #${batchIndex + 1}:`);
            console.log(`👤 Op: ${operatorDid.substring(0, 15)}... | 🤖 Dev: ${deviceDid.substring(0, 15)}...`);

            actionCodes.forEach((code, i) => {
                const actionName = REVERSE_ACTION_MAP[code];
                
                // Pure simulation mein har batch 10 lines ka hota hai
                const localLineIndex = (batchIndex * 10) + i; 

                if (localLogs[localLineIndex]) {
                    const localLineText = localLogs[localLineIndex];
                    const isMatch = localLineText.includes(actionName);

                    if (isMatch) {
                        console.log(`   ✅ Action ${i + 1}: [${actionName}] Matches Log.`);
                        totalMatches++;
                    } else {
                        console.log(`   ❌ Action ${i + 1}: MISMATCH! BC: ${actionName} vs Log Line ${localLineIndex + 1}`);
                        totalMismatches++;
                    }
                }
            });
        });

        console.log(`\n--- 📊 AUDIT REPORT [${logFileName}] ---`);
        console.log(`✅ Matches: ${totalMatches} | ❌ Mismatches: ${totalMismatches}`);
        
        if (totalMismatches === 0 && totalMatches > 0) {
            console.log("🛡️  INTEGRITY CONFIRMED!");
        } else {
            console.log("🚨 ALERT: Inconsistency detected!");
        }

    } catch (error) {
        console.error("❌ Audit Error:", error.message);
    }
}

// Dono files ko verify karein
async function runAllAudits() {
    await verifyAuditTrail('factory_audit.log');       // Marco's Logs
    await verifyAuditTrail('factory_audit_elena.log'); // Elena's Logs
}

runAllAudits();