import { agent } from '../agent.js' 

async function main() {

  const identifier = await agent.didManagerGetByAlias({ alias: 'test' })

  const vc = await agent.createVerifiableCredential({
    credential: {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      type: ["VerifiableCredential", "OperatorSkillCredential"],
      // Issuer is the same as holder in this case (self-issued credential)
      issuer: { id: identifier.did },

      // Credential Subject with claims about the operator's skill
      credentialSubject: {
        id: identifier.did,
        role: "Operator",
        skillName: "CertifiedWelder",
        skillLevel: 5,
      },
    },
    proofFormat: 'jwt',
  })

  //Used `dataStoreSaveVerifiableCredential` to save the credential in the agent's database.
  await agent.dataStoreSaveVerifiableCredential({
    verifiableCredential: vc,
  })

  console.log('\n🎉 Credential Created & Saved:')
  console.log(JSON.stringify(vc, null, 2))
}

main().catch(console.log)
