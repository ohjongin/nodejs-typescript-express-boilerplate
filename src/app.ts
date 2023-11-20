import express from 'express';
import logger from './lib/logger';
import { env } from './env';
import * as mysql from './lib/mysql';
import { build, version } from '../package.json';
import * as process from 'process';
import { isMasterProcess } from 'pm2-master-process';
import os from 'os';
import { finalizeSentry, initSentry } from './ext/app.sentry';
import { initExpress } from './ext/app.express';
import { handleSentry, sleep, terminate } from './lib/utils';
import * as TIME from './common/time';

export const app = express();
export const appPath = __dirname;
export let webSocketServer: any;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// initialize before launching app
const initApp = async () => {
    logger.init({
        log: true,
        sql: true,
        net: true,
        debug: true,
        error: true,
        fatal: true,
        console: false,
    });

    // Test는 DB를 임의로 가공하므로 지정한 환경에서만 동작하도록 한다.
    // 실제 DB에서 테스트하는 일이 없도록 하는 방어코드
    const schemas = [
        { hostname: 'devops', name: 'jenkins', schema: 'ics_dev' },
        { hostname: 'ThinkMac.local', name: 'ics_local', schema: 'ics_local' },
    ]

    const info = schemas.find(h => h.hostname === os.hostname())
    if (env.mysql.name && (info.name !== env.mysql.name || info.schema !== env.mysql.schema)) {
        if (env.mode.test) {
            const msg = `You cannot run a test. The DB schema is not for testing. ${JSON.stringify(info, null, 2)}`;
            console.error(msg);
            logger.error(msg);
            terminate(1);
        } else {
            console.error(`\n\n\n\n`);
            console.error(`=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗`);
            const msg = `You may run a different DB server. The DB schema is not for testing. proper one:\n${JSON.stringify(info, null, 2)}\ncurrent one: ${JSON.stringify(env.mysql, null, 2)}`;
            console.error(msg);
            logger.error(msg);
            console.error(`=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗=-✗`);
            console.error(`\n\n\n\n`);
            console.error(`Waiting for 60 seconds....`);
            await sleep(TIME.SECOND * 60);
        }
    }

    initSentry();
    initExpress();
    finalizeSentry();
}

(async () => {
    try {
        await initApp();

        const pmId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
        const isMaster = await isMasterProcess();
        const worker = isMaster ? 'master' : 'worker';
        const isSuccess = await mysql.connect() ? 'ok' : 'failed';

        app.listen(env.app.port, () => {
            logger.debug(`[${pmId}:${worker}] ----------------------------------------------------------------------------`);
            logger.debug(`[${pmId}:${worker}] 🚀 App listening on the port ${env.app.port} at ${os.hostname()}`);
            logger.debug(`[${pmId}:${worker}]    Initialize result: ${isSuccess}`);
            logger.debug(`[${pmId}:${worker}] ============================================================================`);

            console.log(`${new Date().toISOString()} [${pmId}:${worker}][ v${build || version}, ${env.mode.value}, ${env.mysql.schema}, ${isSuccess} ] =================================== READY !!!`);
        });
    } catch (e) {
        logger.error(e);
        handleSentry('fata', e)
    }
})();