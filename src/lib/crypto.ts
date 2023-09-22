import crypto from 'crypto';
import fs from 'fs';
import appRoot from 'app-root-path';
import path from 'path';
import cryptojs from 'crypto-js';

export const generateKeyPairSync = () => {
    // The `generateKeyPairSync` method accepts two arguments:
    // 1. The type ok keys we want, which in this case is "rsa"
    // 2. An object with the properties of the key
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        // The standard secure default length for RSA keys is 2048 bits
        modulusLength: 2048,
    })

    return { publicKey, privateKey };
}

export function encryptText (plainText) {
    return crypto.publicEncrypt({
            key: fs.readFileSync(path.join(appRoot.path, 'public.pem'), 'utf8'),
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        // We convert the data string to a buffer
        Buffer.from(plainText)
    )
}

export function decryptText (encryptedText) {
    return crypto.privateDecrypt(
        {
            key: fs.readFileSync(path.join(appRoot.path, 'private.pem'), 'utf8'),
            // In order to decrypt the data, we need to specify the
            // same hashing function and padding scheme that we used to
            // encrypt the data in the previous step
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        encryptedText
    )
}

export const encryptSimple = (text: string) => {
    // return cryptojs.AES.encrypt(text, '').toString();
    return cryptojs.enc.Base64.stringify(cryptojs.enc.Utf8.parse(text));
}

export const decryptSimple = (data: string) => {
    // return cryptojs.AES.encrypt(text, '').toString();
    return cryptojs.enc.Base64.parse(data).toString(cryptojs.enc.Utf8);
}
