import fs from 'fs'
import { agent } from '../agent.js'
import { ethers } from 'ethers'
import * as dotenv from 'dotenv';
dotenv.config();

// --- CONFIGURATION ---
const RPC = "https://ethereum-sepolia-rpc.publicnode.com"
const PRIVATE_KEY = "0xf58599b4f5d5b15d7158226f7dc3e611ffdd8ff608def33bab39f1add282eff1"// Replace with your Sepolia wallet private key
const CONTRACT_ADDRESS =  "0x5b23fFb4956E20dC719b4d09c48829871aD244C3"
const ABI = ["function logBatch(string,string,uint8[])"]

// Action Dictionary (MAPPING: String to Number for Blockchain)
const ACTION_MAP = { 
    "MOVE_UP": 0, 
    "MOVE_DOWN": 1, 
    "SWITCH_ON": 2, 
    "SWITCH_OFF": 3,
    "ROTATE": 4, 
    "CUT": 5 
}

let sessionBuffer = [] 

async function runOperation(opAlias, devAlias, action) {
    console.log(`\n🔍 GATEWAY: Checking access for ${opAlias} on ${devAlias}...`)

    // 1. Resolve Identities
    const operator = await agent.didManagerGetByAlias({ alias: opAlias })
    const device = await agent.didManagerGetByAlias({ alias: devAlias })
    const admin = await agent.didManagerGetByAlias({ alias: 'factory-admin' })

    // 2. AUTHORIZATION & CAPABILITY CHECK
    const vcs = await agent.dataStoreORMGetVerifiableCredentials({
        where: [{ column: 'subject', value: [operator.did] }] 
    })

    const validPermit = vcs.find(vc => 
        vc.verifiableCredential.issuer.id === admin.did && 
        vc.verifiableCredential.credentialSubject.authorizedDeviceId === device.did
    )

    // CHECK A: Is there a permit?
    if (!validPermit) {
        console.log(`❌ ACCESS DENIED: ${opAlias} has no permit for ${devAlias}!`)
        fs.appendFileSync('security_violations.log', `[${new Date().toISOString()}] DENIED: ${opAlias} unauthorized for ${devAlias}\n`)
        return; 
    }

    // CHECK B: Is the action allowed for this specific machine?
    const allowedActions = validPermit.verifiableCredential.credentialSubject.allowedActions || [];
    if (!allowedActions.includes(action)) {
        console.log(`🚫 ACTION BLOCKED: ${opAlias} is authorized, but ${devAlias} cannot perform [${action}]!`)
        fs.appendFileSync('security_violations.log', `[${new Date().toISOString()}] INVALID_ACTION: ${opAlias} tried ${action} on ${devAlias}\n`)
        return;
    }

    console.log(`🔓 ACCESS GRANTED: Executing ${action}...`)

    // 3. ACCOUNTING (Local Log)
    const logEntry = `[${new Date().toISOString()}] OP: ${opAlias} | DEV: ${devAlias} | ACT: ${action}\n`
    fs.appendFileSync('factory_audit.log', logEntry)
    console.log(`💾 Local Logged: ${action} (factory_audit.log)`)

    // 4. BATCHING (Blockchain)
    sessionBuffer.push(ACTION_MAP[action])
    console.log(`📊 Batch Status: ${sessionBuffer.length}/10`)

    if (sessionBuffer.length >= 10) {
        console.log("📦 BATCH FULL: Syncing to Sepolia Blockchain...")
        await sendBatchToBlockchain(operator.did, device.did, sessionBuffer)
        sessionBuffer = [] 
    }
}

async function sendBatchToBlockchain(opDid, devDid, batch) {
    try {
        const provider = new ethers.JsonRpcProvider(RPC)
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet)
        
        const tx = await contract.logBatch(opDid, devDid, batch)
        console.log(`⏳ Pending Tx: ${tx.hash}`)
        await tx.wait()
        console.log("✅ BATCH PERMANENTLY LOGGED ON-CHAIN")
    } catch (e) { console.error("❌ BC Fail:", e.message) }
}
async function startDemo() {
    console.log("🏭 Starting MIXED-ASSET Factory Simulation...");

    // --- MIXED SEQUENCE ---
    
    // 1. Marco starts Welding (Valid)
    await runOperation('operator-marco', 'welding-robot-09', 'SWITCH_ON');
    await runOperation('operator-marco', 'welding-robot-09', 'MOVE_UP');

    // 2. Elena starts CNC (Valid)
    await runOperation('operator-elena', 'cnc-lathe-01', 'SWITCH_ON');
    await runOperation('operator-elena', 'cnc-lathe-01', 'ROTATE');

    // 3. Marco continues Welding (Valid)
    await runOperation('operator-marco', 'welding-robot-09', 'MOVE_DOWN');
    await runOperation('operator-marco', 'welding-robot-09', 'MOVE_UP');

    // 4. 🔥 SECURITY TEST: Elena tries to access Marco's Welding Robot (Should be DENIED)
    console.log("\n🚨 ALERT: Unauthorized cross-device attempt...");
    await runOperation('operator-elena', 'welding-robot-09', 'SWITCH_OFF');

    // 5. Elena continues CNC (Valid)
    await runOperation('operator-elena', 'cnc-lathe-01', 'CUT');
    await runOperation('operator-elena', 'cnc-lathe-01', 'CUT');

    // 6. 🔥 SECURITY TEST: Marco tries an invalid action on his own machine (Should be BLOCKED)
    console.log("\n🚨 ALERT: Unsupported capability attempt...");
    await runOperation('operator-marco', 'welding-robot-09', 'ROTATE'); // Marco can't rotate!

    // 7. Finishing the batch with Valid actions
    await runOperation('operator-elena', 'cnc-lathe-01', 'SWITCH_OFF');
    await runOperation('operator-marco', 'welding-robot-09', 'SWITCH_OFF');

    console.log("\n🏁 Mixed Session Finished. Check factory_audit.log and security_violations.log");
}

startDemo();
