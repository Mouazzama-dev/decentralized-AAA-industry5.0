import { agent } from '../agent.js'
import { ethers } from "ethers"

const RPC = "https://ethereum-sepolia-rpc.publicnode.com"
const PRIVATE_KEY = ""
const CONTRACT_ADDRESS = "0xCB14E1EE8D2542193AEdF26e489415433a2C151D"

const ABI = [
  "function logAccess(string,string,uint256,bool)"
]


async function main() {
  console.log('\n🛡  Gateway: verifying VP and applying access policy...\n')

  // 1) Fetch one stored VC and build a VP (simulating the operator presenting it)
  const creds = await agent.dataStoreORMGetVerifiableCredentials()
  if (creds.length === 0) {
    console.log('❌ No credentials found in DB. Run create-credential.js first.')
    return
  }

  const vc = creds[0].verifiableCredential
  const holderDid = vc.credentialSubject.id

  const vp = await agent.createVerifiablePresentation({
    presentation: {
      holder: holderDid,
      verifiableCredential: [vc],
    },
    proofFormat: 'jwt',
  })

  // 2) Verify VP (Gateway verification)
  const verification = await agent.verifyPresentation({
    presentation: vp,
    policies: { proofFormat: 'jwt' },
  })

  console.log('✅ VP verified:', verification.verified)

  if (!verification.verified) {
    console.log('❌ Access denied: VP verification failed.')
    return
  }

  // 3) Extract claims (Authorization input)
  const presentedVC = verification.verifiablePresentation.verifiableCredential[0]
  const cs = presentedVC.credentialSubject

  const role = cs.role
  const skillName = cs.skillName
  // const skillLevel = Number(cs.skillLevel) // ensure it's a number for comparison
  const skillLevel = Number(1);

  // 4) Apply access policy (your "Authorization SC" simulated)
  const REQUIRED_SKILL = 'CertifiedWelder'
  const MIN_LEVEL = 4
  

  const allowed =
    role === 'Operator' &&
    skillName === REQUIRED_SKILL &&
    skillLevel >= MIN_LEVEL

const provider = new ethers.JsonRpcProvider(RPC)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet)

await contract.logAccess(
  holderDid,
  skillName,
  skillLevel,
  allowed
)

console.log("\n⛓ Access event logged on blockchain")


  console.log('\n📌 Extracted claims:')
  console.log({ holderDid, role, skillName, skillLevel })

  console.log('\n📜 Policy:')
  console.log(`Allow if role=Operator AND skillName=${REQUIRED_SKILL} AND skillLevel>=${MIN_LEVEL}`)

  console.log('\n🚦 Decision:')
  console.log(allowed ? '✅ ACCESS GRANTED (unlock machine)' : '❌ ACCESS DENIED')

  // 5) Optional: pretend to send command to IoT machine
  console.log('\n🤖 Machine command:')
  console.log(allowed ? 'UNLOCK_WELDING_ROBOT' : 'LOCK')
}

main().catch(console.log)
