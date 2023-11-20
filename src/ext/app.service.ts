import {BaseService} from '../common/base/base.service';
import fs from "fs";
import path from "path";
import logger from "../lib/logger";
import appRoot from "app-root-path";

export default class AppService extends BaseService {
    constructor(context) {
        super(context);
    }

    describeHealthInfo = async () => {
        let pkg;
        try {
            const data = fs.readFileSync(path.join(appRoot.path, 'package.json'), { encoding: 'utf8', flag: 'r' });
            pkg = JSON.parse(data);
        } catch (e) {
            logger.error(JSON.stringify(e));
        }
        return { version: pkg.version };
    }
}
