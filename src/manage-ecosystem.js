import { agent } from '../agent.js'

async function getOrCreateDID(alias) {
  try {
    const existing = await agent.didManagerGetByAlias({ alias })
    console.log(`✅ Existing: ${alias} -> ${existing.did}`)
    return existing
  } catch (e) {
    const created = await agent.didManagerCreate({ alias, provider: 'did:ethr:sepolia' })
    console.log(`🆕 Created: ${alias} -> ${created.did}`)
    return created
  }
}

async function main() {
  console.log('🏗️  Setting up Multi-Asset Factory...')
  await getOrCreateDID('operator-marco')
  await getOrCreateDID('operator-elena')
  await getOrCreateDID('welding-robot-09')
  await getOrCreateDID('cnc-lathe-01')
  await getOrCreateDID('factory-admin')
  console.log('✨ All identities ready.')
}

main().catch(console.log)