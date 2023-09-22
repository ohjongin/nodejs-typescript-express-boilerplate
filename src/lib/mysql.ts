import {Model, Sequelize} from 'sequelize';
import env from '../env';
import logger from '../lib/logger';
import * as process from 'process';
import {initialize} from './init';
import {validateSchemas} from './validate-schema';
import {isMasterProcess} from 'pm2-master-process';

const sequelize = new Sequelize(env.mysql.schema, null, null, {
    dialect: 'mysql',
    dialectOptions: {
        connectTimeout: env.mode.prod ? 5000 : 60000 // 5s for prod, 1min for dev
    },
    port: parseInt(env.mysql.port, 10),
    replication: {
        read: [
            {
                host: env.mysql.read.host,
                username: env.mysql.read.username,
                password: env.mysql.read.password
            },
        ],
        write: {
            host: env.mysql.write.host,
            username: env.mysql.write.username,
            password: env.mysql.write.password
        }
    },
    define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
        freezeTableName: true,
        hooks: {
            afterCreate: async (instance: Model) => {
                onSequelizeHooks(instance, 'create');
            },
            afterUpdate: async (instance: Model) => {
                onSequelizeHooks(instance, 'update');
            },
            afterDestroy: async (instance: Model) => {
                onSequelizeHooks(instance, 'delete');
            }
        }
    },
    timezone: '+09:00',
    logQueryParameters: !env.mode.prod,
    logging: (query) => {
        if (query?.includes('SELECT 1+1 AS result')) return;
        logger.sql(query.replace(/(\r\n|\n|\r)/gm, ''));
    },
});

export { sequelize as mysql };

export function initModels() {
}

export function connect() {
    return new Promise((resolve, reject) => {
        initModels();

        sequelize
            .authenticate()
            .then(async function onSequelizeAuthSuccess() {
                const isMaster = await isMasterProcess();
                const worker = isMaster ? 'master' : 'worker';
                logger.debug(`[${process.env.pm_id}:${worker}] MySQL connection has been established successfully.`);

                try {
                    if (isMaster) {
                        await validateSchemas(sequelize, { logging: env.mode.prod ? logger.debug : console.log });
                        await initialize();
                    }
                    resolve(sequelize);
                } catch (e) {
                    console.log(e);
                    logger.error(e);
                    reject(e);
                }
            })
            .catch(async function onSequelizeAuthError(err) {
                const isMaster = await isMasterProcess();
                const worker = isMaster ? 'master' : 'worker';
                console.log(err);
                logger.error(err);
                logger.error(`[${process.env.pm_id}:${worker}] Unable to connect to the database:`, err);
                reject(err);
            });
    });
}

export const onSequelizeHooks = (instance: Model, action: string) => {
    if (!env.aws.sqs.queue.url) return;
    if (!(instance instanceof Model)) return;

    // @ts-ignore
    const tableName = instance?.constructor?.getTableName();
};

export const getJsonExtractWhere = (col, field, value) => {
    const extractCall = Sequelize.fn('JSON_EXTRACT', Sequelize.col(col), Sequelize.literal(`'$.${field}'`));
    const unquoteCall = Sequelize.fn('JSON_UNQUOTE', extractCall);
    return Sequelize.where(Sequelize.fn('LOWER', unquoteCall), value?.toLowerCase());
}
