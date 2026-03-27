import { agent } from '../agent.js'
import { ethers } from "ethers"

// --- CONFIGURATION ---
const RPC = "https://ethereum-sepolia-rpc.publicnode.com"
const PRIVATE_KEY = "0xf58599b4f5d5b15d7158226f7dc3e611ffdd8ff608def33bab39f1add282eff1" // ⚠️ 
const CONTRACT_ADDRESS = "0xCB14E1EE8D2542193AEdF26e489415433a2C151D"

const ABI = ["function logAccess(string,string,uint256,bool)"]

async function main() {
  console.log('🛡️  GATEWAY: Initializing Verification & Blockchain Sync...\n')

  // 1. Robot ki apni identity fetch karein (Simulating the machine's ID)
  const robot = await agent.didManagerGetByAlias({ alias: 'welding-robot-09' })
  const myRobotId = robot.did
  
  // 2. Database se latest Industrial Permit (VC) uthayein
  const credentials = await agent.dataStoreORMGetVerifiableCredentials()
  if (credentials.length === 0) {
    console.log("❌ No permits found in database. Run issue-permit.js first.")
    return
  }

  // Last issued credential pick kar rahe hain
  const vc = credentials[credentials.length - 1].verifiableCredential 
  const cs = vc.credentialSubject

  // 3. POLICY CHECK (Logic Gate)
  const isCorrectMachine = cs.authorizedDeviceId === myRobotId
  const isQualified = Number(cs.skillLevel) >= 4
  const role = cs.role || "Unknown"

  const accessGranted = isCorrectMachine && isQualified

  console.log('-------------------------------------------')
  console.log(`👤 Operator DID: ${cs.id}`)
  console.log(`🤖 Device Target: ${cs.authorizedDeviceId}`)
  console.log(`📊 Level Check:  ${cs.skillLevel} (Required: 4+)`)
  console.log(`🎯 Match Result: ${isCorrectMachine ? "✅ MATCH" : "❌ WRONG MACHINE"}`)
  console.log('-------------------------------------------')

  // 4. BLOCKCHAIN LOGGING (The Audit Trail)
  console.log('⛓️  Logging result to Sepolia Blockchain...')
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC)
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet)

    const tx = await contract.logAccess(
      cs.id,              // operatorDid
      role,               // skill/role
      Number(cs.skillLevel), 
      accessGranted       // bool (granted)
    )

    console.log(`⏳ Transaction Sent! Hash: ${tx.hash}`)
    await tx.wait()
    console.log("✅ ACCESS EVENT LOGGED ON-CHAIN")

  } catch (error) {
    console.error("❌ Blockchain logging failed:", error.message)
  }

  // 5. FINAL DECISION
  if (accessGranted) {
    console.log("\n🔓 SUCCESS: Machine Unlocked for Operator.")
  } else {
    console.log("\n🔒 DENIED: Safety Protocol Active. Machine Locked.")
  }
}

main().catch(console.log)