import { agent } from '../agent.js' 

async function main() {

  const identifier = await agent.didManagerGetByAlias({ alias: 'default' })

  const vc = await agent.createVerifiableCredential({
    credential: {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      type: ["VerifiableCredential", "OperatorSkillCredential"],

      issuer: { id: identifier.did },

      credentialSubject: {
        id: identifier.did,
        role: "Operator",
        skillName: "CertifiedWelder",
        skillLevel: 5,
      },
    },
    proofFormat: 'jwt',
  })

  /** ✅ SAVE USING CORRECT METHOD **/
  await agent.dataStoreSaveVerifiableCredential({
    verifiableCredential: vc,
  })

  console.log('\n🎉 Credential Created & Saved:')
  console.log(JSON.stringify(vc, null, 2))
}

main().catch(console.log)
