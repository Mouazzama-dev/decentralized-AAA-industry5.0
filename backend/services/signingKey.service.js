import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


/*
 * ---------------------------------------------------------------
 * GATEWAY SIGNING KEY SERVICE
 * ---------------------------------------------------------------
 *
 * Ye gateway ki identity hai. Har local block isi private key se
 * sign hoga, taa ke koi attacker DB mein ghus ke fake block na
 * bana sake.
 *
 * ⚠️ SECURITY NOTE (meeting wali key-management problem):
 * Filhaal key ek local file mein store ho rahi hai sirf development
 * ke liye. Production mein ye key MongoDB wale server pe NAHI honi
 * chahiye — warna jo attacker DB chhed sakta hai wo key bhi chura
 * lega aur phir fake signatures bana lega.
 *
 * Production options:
 *   - Alag hardware security module (HSM) / TPM
 *   - Factory ka secure element
 *   - Ya kam se kam ek env variable jo DB server se alag manage ho
 *
 * Jab move karna ho, sirf loadKeyPair() ka source badalna hai —
 * baaqi code same rahega.
 * ---------------------------------------------------------------
 */


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Development ke liye local key folder
const KEY_DIR = path.join(__dirname, "..", "keys");
const PRIVATE_KEY_PATH = path.join(KEY_DIR, "gateway_private.pem");
const PUBLIC_KEY_PATH = path.join(KEY_DIR, "gateway_public.pem");


let cachedKeyPair = null;


/*
 * Pehli dafa key generate karta hai, phir file mein save.
 * Agली dafa se file se hi load hoga.
 */
const loadKeyPair = () => {

    if (cachedKeyPair) {
        return cachedKeyPair;
    }

    // Agar keys pehle se maujood hain to load kar lo
    if (
        fs.existsSync(PRIVATE_KEY_PATH) &&
        fs.existsSync(PUBLIC_KEY_PATH)
    ) {

        const privateKeyPem =
            fs.readFileSync(PRIVATE_KEY_PATH, "utf8");

        const publicKeyPem =
            fs.readFileSync(PUBLIC_KEY_PATH, "utf8");

        cachedKeyPair = {
            privateKey:
                crypto.createPrivateKey(privateKeyPem),
            publicKey:
                crypto.createPublicKey(publicKeyPem),
            publicKeyPem
        };

        return cachedKeyPair;
    }

    // Warna nayi key pair generate karo (Ed25519)
    console.log("🔑 No gateway key found. Generating a new Ed25519 keypair...");

    const { privateKey, publicKey } =
        crypto.generateKeyPairSync("ed25519");

    const privateKeyPem =
        privateKey.export({
            type: "pkcs8",
            format: "pem"
        });

    const publicKeyPem =
        publicKey.export({
            type: "spki",
            format: "pem"
        });

    // Keys folder banao agar nahi hai
    if (!fs.existsSync(KEY_DIR)) {
        fs.mkdirSync(KEY_DIR, { recursive: true });
    }

    fs.writeFileSync(PRIVATE_KEY_PATH, privateKeyPem, { mode: 0o600 });
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKeyPem);

    console.log("✅ Gateway keypair generated and saved to /backend/keys");

    cachedKeyPair = {
        privateKey,
        publicKey,
        publicKeyPem
    };

    return cachedKeyPair;
};


/*
 * Kisi bhi string (ya buffer) ko gateway ki private key se sign
 * karta hai. Return: hex signature.
 */
const signMessage = (message) => {

    const { privateKey } = loadKeyPair();

    // Ed25519 mein algorithm null hota hai — data direct sign hota hai
    const signature =
        crypto.sign(
            null,
            Buffer.from(message),
            privateKey
        );

    return signature.toString("hex");
};


/*
 * Signature verify karta hai. Agar publicKeyPem diya jaye to usse,
 * warna gateway ki apni public key se check karta hai.
 * Return: true / false.
 */
const verifySignature = (
    message,
    signatureHex,
    publicKeyPem = null
) => {

    let publicKey;

    if (publicKeyPem) {
        publicKey = crypto.createPublicKey(publicKeyPem);
    } else {
        publicKey = loadKeyPair().publicKey;
    }

    try {

        return crypto.verify(
            null,
            Buffer.from(message),
            publicKey,
            Buffer.from(signatureHex, "hex")
        );

    } catch (error) {

        // Malformed signature = invalid
        return false;
    }
};


/*
 * Gateway ki public key (PEM) return karta hai — ye har block ke
 * saath store hogi taa ke verify karne wale ko key mil jaye.
 */
const getPublicKeyPem = () => {

    return loadKeyPair().publicKeyPem;
};


export {
    loadKeyPair,
    signMessage,
    verifySignature,
    getPublicKeyPem
};