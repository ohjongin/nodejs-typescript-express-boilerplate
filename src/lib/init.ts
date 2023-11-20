import path from 'path';
import fs from 'fs';
import logger from './logger';
import {mysql} from './mysql';
import {appPath} from '../app';
import {handleSentry, initTempDir} from './utils';

export const initialize = async () => {
    try {
        const str = fs.readFileSync(path.join(appPath, 'assets', 'init-data.json'), { encoding: 'utf8', flag: 'r' });
        const json = JSON.parse(str);

        await initRootAccount(json);
        await healthCheck();
        initTempDir();
    } catch (e) {
        logger.error(e);
    }
}

const initRootAccount = async (json) => {
    const transaction = await mysql.transaction();
    try {
        await transaction.commit();
    } catch (e) {
        // @ts-ignore
        if (transaction?.finished !== 'commit') await transaction.rollback();

        logger.error(e);
        handleSentry('fatal', e);

        throw e;
    }
};

const healthCheck = async () => {
    logger.info('health check');
}