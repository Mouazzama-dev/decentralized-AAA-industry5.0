import { agent } from '../agent.js'
import { ethers } from "ethers"

// --- CONFIGURATION ---
const RPC = "https://ethereum-sepolia-rpc.publicnode.com"
const PRIVATE_KEY = "0xYOUR_PRIVATE_KEY_HERE" // Replace with your Sepolia wallet private key
const CONTRACT_ADDRESS = "0xCB14E1EE8D2542193AEdF26e489415433a2C151D"
const ABI = ["function logAccess(string,string,uint256,bool)"]

async function main() {
  console.log('🛡️  GATEWAY: Initializing Verification & Blockchain Sync...\n')

  // 1. Fetch Identities from DB
  const robot = await agent.didManagerGetByAlias({ alias: 'welding-robot-09' })
  const admin = await agent.didManagerGetByAlias({ alias: 'factory-admin' })
  const myRobotId = robot.did
  
  // 2. Fetch Credentials from DB
  const credentials = await agent.dataStoreORMGetVerifiableCredentials()
  if (credentials.length === 0) {
    console.log("❌ No permits found. Run issue-permit.js first.")
    return
  }

  // Pick the latest credential
  const latestCredential = credentials[credentials.length - 1].verifiableCredential 
  const cs = latestCredential.credentialSubject

  // 3. TRUST & POLICY CHECK
  // Rule A: Was it issued by our Admin?
  const isTrustedIssuer = latestCredential.issuer.id === admin.did
  
  // Rule B: Is it for THIS machine?
  const isCorrectMachine = cs.authorizedDeviceId === myRobotId
  
  // Rule C: Is the skill level sufficient?
  const isQualified = Number(cs.skillLevel) >= 4

  const accessGranted = isTrustedIssuer && isCorrectMachine && isQualified

  console.log('-------------------------------------------')
  console.log(`📜 Issuer:       ${latestCredential.issuer.id === admin.did ? "✅ FACTORY ADMIN" : "❌ UNKNOWN"}`)
  console.log(`👤 Operator:     ${cs.id}`)
  console.log(`🤖 Device Match: ${isCorrectMachine ? "✅ MATCH" : "❌ WRONG DEVICE"}`)
  console.log(`📊 Skill Level:  ${cs.skillLevel} (Req: 4+)`)
  console.log('-------------------------------------------')

  if (!isTrustedIssuer) {
    console.log("🚨 SECURITY ALERT: Unauthorized Issuer detected!")
  }

  // 4. BLOCKCHAIN LOGGING
  console.log('⛓️  Logging result to Sepolia Blockchain...')
  try {
    const provider = new ethers.JsonRpcProvider(RPC)
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet)

    const tx = await contract.logAccess(
      cs.id, 
      cs.role || "Operator", 
      Number(cs.skillLevel), 
      accessGranted
    )
    console.log(`⏳ Tx Hash: ${tx.hash}`)
    await tx.wait()
    console.log("✅ ACCESS EVENT LOGGED ON-CHAIN")
  } catch (error) {
    console.error("❌ Blockchain logging failed:", error.message)
  }

  // 5. FINAL DECISION
  if (accessGranted) {
    console.log("\n🔓 SUCCESS: Machine Unlocked.")
  } else {
    console.log("\n🔒 DENIED: Unauthorized or Unqualified.")
  }
}

main().catch(console.log)