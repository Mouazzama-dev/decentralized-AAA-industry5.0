import { agent } from '../agent.js'

async function main() {
  console.log('Setting up Industrial Ecosystem...\n')

  // 1. Create a Human Operator
  const operator = await agent.didManagerCreate({ 
    alias: 'operator-marco',
    provider: 'did:ethr:sepolia' 
  })
  console.log(`👤 OPERATOR ADDED: ${operator.did}`)

  // 2. Create a Machine (IoT Device)
  const device = await agent.didManagerCreate({ 
    alias: 'welding-robot-09',
    provider: 'did:ethr:sepolia' 
  })
  console.log(`🤖 DEVICE ADDED:   ${device.did}`)

  // 3. Create a Factory Admin (for future use)
  const admin = await agent.didManagerCreate({ 
    alias: 'factory-admin',
    provider: 'did:ethr:sepolia'    
})
console.log(`🔑 ADMIN DID: ${admin.did}`)

  console.log('\n✅ Identities registered in database.sqlite')
}

main().catch(console.log)