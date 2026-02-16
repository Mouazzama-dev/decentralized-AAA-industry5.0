import 'reflect-metadata'

import { createAgent } from '@veramo/core'
import { DIDManager } from '@veramo/did-manager'
import { EthrDIDProvider } from '@veramo/did-provider-ethr'
import { KeyManager } from '@veramo/key-manager'
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local'
import { CredentialPlugin } from '@veramo/credential-w3c'
import { CredentialProviderJWT } from '@veramo/credential-jwt'
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'
import { getResolver as webDidResolver } from 'web-did-resolver'
import { Entities, KeyStore, DIDStore, PrivateKeyStore, migrations } from '@veramo/data-store'
import { DataSource } from 'typeorm'
import { DataStore, DataStoreORM } from '@veramo/data-store'


/***************************************
 * CONFIGURATION
 ***************************************/

const DATABASE_FILE = 'database.sqlite'
const INFURA_PROJECT_ID = ''   // ← leave empty for now
const KMS_SECRET_KEY = 'de1e045d46d2a99bff4fd8a7c3f11ca4e3c65e57603e15c499a26c5b1ea5929b'

/***************************************
 * DATABASE INITIALIZATION
 ***************************************/

const dbConnection = await new DataSource({
  type: 'sqlite',
  database: DATABASE_FILE,
  synchronize: false,
  migrations,
  migrationsRun: true,
  logging: false,
  entities: Entities,
}).initialize()

/***************************************
 * VERAMO AGENT
 ***************************************/

export const agent = createAgent({
  plugins: [

    new KeyManager({
      store: new KeyStore(dbConnection),
      kms: {
        local: new KeyManagementSystem(
          new PrivateKeyStore(
            dbConnection,
            new SecretBox(KMS_SECRET_KEY)
          )
        ),
      },
    }),

    new DIDManager({
      store: new DIDStore(dbConnection),
      defaultProvider: 'did:ethr:sepolia',
      providers: {
        'did:ethr:sepolia': new EthrDIDProvider({
          defaultKms: 'local',
          network: 'sepolia',
          rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
        }),
      },
    }),

        new DataStore(dbConnection),
    new DataStoreORM(dbConnection),


new DIDResolverPlugin({
  ...ethrDidResolver({
    networks: [
      {
        name: 'sepolia',
        chainId: 11155111,
        rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
        registry: '0x03d5003bf0e79C5F5223588F347ebA39AfbC3818',
      },
    ],
  }),
  ...webDidResolver(),
}),



    new CredentialPlugin({
      credentialProviders: [new CredentialProviderJWT()],
    }),
  ],
})
