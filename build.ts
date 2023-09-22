import fs from 'fs';
import { generate } from 'build-number-generator';

(() => {
    const data = fs.readFileSync('package.json', { encoding: 'utf8', flag: 'r' });
    const pkg = JSON.parse(data);

    pkg.build = generate({ version: pkg.version });
    fs.writeFile('package.json', JSON.stringify(pkg, null, 2), function (err) {
        if (err) throw err;
    });
})();
