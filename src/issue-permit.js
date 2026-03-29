import { agent } from '../agent.js'

async function main() {
  // Database se identities uthayein
  const operator = await agent.didManagerGetByAlias({ alias: 'operator-marco' })
  const device = await agent.didManagerGetByAlias({ alias: 'welding-robot-09' })
  const admin = await agent.didManagerGetByAlias({ alias: 'factory-admin' })

  console.log(`Issuing permit for ${operator.did} to use ${device.did}...`)

  const vc = await agent.createVerifiableCredential({
    credential: {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      type: ["VerifiableCredential", "MachineAccessPermit"],
      issuer: { id: admin.did },      
      credentialSubject: {
        id: operator.did,
        role: "SeniorWelder",
        skillLevel: 5,
        authorizedDeviceId: device.did, // <--- Device link with operator
        validUntil: "2026-12-31"
      },
    },
    proofFormat: 'jwt',
  })

  // DB mein save karein
  await agent.dataStoreSaveVerifiableCredential({ verifiableCredential: vc })

  console.log('\n Industrial Permit Created & Saved!')
  console.log(JSON.stringify(vc, null, 2))
}

main().catch(console.log)