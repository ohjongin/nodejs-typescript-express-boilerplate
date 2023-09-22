import { Encryptor } from 'strong-cryptor';

(() => {
    console.log(process.argv);

    if (!process.env.ENCRYPT_SECRET_KEY) {
        console.error('process.env.ENCRYPT_SECRET_KEY not set!');
        process.exit(1);
    }

    if (process.argv.length === 3) {
        console.error('Expected at least one argument!');
        process.exit(1);
    }

    const model = process.argv[2];
    console.log(model);

    const password = process.argv[3];
    const crypto = new Encryptor({ key: process.env.ENCRYPT_SECRET_KEY });
    const encrypted = crypto.encrypt(password);
    console.log(password, encrypted);
})();
