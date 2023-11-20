import * as dotenv from 'dotenv';
import * as path from 'path';

import * as pkg from '../package.json';
import appRoot from 'app-root-path';
import fs from 'fs';
import * as process from 'process';
import {
    getOsEnv,
    getOsEnvBoolOptional,
    getOsEnvNumber,
    getOsEnvNumberOptional,
    getOsEnvOptional,
    normalizePort
} from './lib/env.utils';
import { terminate } from './lib/utils';

/**
 * Load .env file or for tests the .env.test file.
 */
const postfix = () => {
    const envs = [ ['prod', ''], ['dev']];
    const env = process.env.NODE_ENV?.toLowerCase();

    if (!env) return '';

    let result = '.' + env;
    // return true 는 break
    // return false 는 continue
    envs.some(e => {
        const key = e[0];
        const found = env.includes(key);
        if (found) result = '.' + (e.length > 1 ? e[1] : key);

        return found;
    });

    return result;
}

const config = { path: path.join(appRoot.path, `.env${postfix()}`) };

(() => {
    try {
        if (fs.existsSync(config.path)) {
            //file exists
        } else {
            console.error(process.env.NODE_ENV, JSON.stringify(config));
            terminate(1);
        }
    } catch(err) {
        console.error(process.env.NODE_ENV, JSON.stringify(config), err);
        terminate(1);
    }
})();

dotenv.config(config);

/**
 * Environment variables
 */
export const env = {
    config: config,
    mode: {
        prod: process.env.NODE_ENV?.toLowerCase().includes('prod'),
        dev: process.env.NODE_ENV?.toLowerCase().includes('dev'),
        test: process.env.NODE_ENV?.toLowerCase().includes('test'),
        value: process.env.NODE_ENV?.toLowerCase(),
    },
    init: {
        db: {
            root: {
            },
        },
    },
    auth: {
        jwt: {
            secret: getOsEnv('SECRET_JWT'),
        },
        secret: getOsEnv('SECRET_KEY'),
    },
    mysql: {
        name:  getOsEnvOptional('MYSQL_NAME', undefined),
        schema: getOsEnv('MYSQL_SCHEMA'),
        port: getOsEnv('MYSQL_PORT'),
        option: {
            timeout: getOsEnvNumberOptional('MYSQL_OPTION_TIMEOUT', 5000),
        },
        write: {
            host: getOsEnv('MYSQL_WRITE_HOST'),
            username: getOsEnv('MYSQL_WRITE_USERNAME'),
            password: getOsEnv('MYSQL_WRITE_PASSWORD'),        },
        read: {
            host: getOsEnv('MYSQL_READ_HOST'),
            username: getOsEnv('MYSQL_READ_USERNAME'),
            password: getOsEnv('MYSQL_READ_PASSWORD'),
        },
        pool: {
            min: getOsEnvNumberOptional('MYSQL_POOL_MIN', 1),
            max: getOsEnvNumberOptional('MYSQL_POOL_MAX', 5),
            idle: getOsEnvNumberOptional('MYSQL_POOL_IDLE', 10000),
            acquire: getOsEnvNumberOptional('MYSQL_POOL_ACQUIRE', 30000),
        },
    },
    aws: {
        key: {
            id: getOsEnv('AWS_ACCESS_KEY_ID'),
            secret: getOsEnv('AWS_ACCESS_KEY_SECRET'),
        },
        s3: {
            docs: {
                value: getOsEnv('AWS_S3_DOCS_BUCKET'),
                bucket: getOsEnv('AWS_S3_DOCS_BUCKET').split('/')[0],
                path: getOsEnv('AWS_S3_DOCS_BUCKET').split('/')[1],
            },
            images: {
                value: getOsEnv('AWS_S3_IMAGES_BUCKET'),
                bucket: getOsEnv('AWS_S3_IMAGES_BUCKET').split('/')[0],
                path: getOsEnv('AWS_S3_IMAGES_BUCKET').split('/')[1],
            },
            temp: {
                value: getOsEnv('AWS_S3_TEMP_BUCKET'),
                bucket: getOsEnv('AWS_S3_TEMP_BUCKET').split('/')[0],
                path: getOsEnv('AWS_S3_TEMP_BUCKET').split('/')[1],
            },
            template: {
                value: getOsEnv('AWS_S3_TEMPLATE_BUCKET'),
                bucket: getOsEnv('AWS_S3_TEMPLATE_BUCKET').split('/')[0],
                path: getOsEnv('AWS_S3_TEMPLATE_BUCKET').split('/')[1],
            },
            cdn: {
                value: getOsEnv('AWS_S3_CDN_BUCKET'),
                bucket: getOsEnv('AWS_S3_CDN_BUCKET').split('/')[0],
                path: getOsEnv('AWS_S3_CDN_BUCKET').split('/')[1],
            }
        },
        sqs: {
            queue: {
                url: getOsEnvOptional('AWS_SQS_QUEUE_URL'),
            }
        }
    },
    app: {
        name: getOsEnv('APP_NAME'),
        version: pkg.version,
        description: pkg.description,
        port: normalizePort(process.env.APP_PORT),
        cors: {
            origins: getOsEnvOptional('APP_CORS_ORIGINS') || getOsEnvOptional('APP_WEB_URL')
        },
        sentry: {
            dsn: getOsEnvOptional('APP_SENTRY_DSN'),
        },
        web: {
            url: getOsEnvOptional('APP_WEB_URL'),
        },
        hostname: getOsEnvOptional('APP_HOSTNAME'),
        log: {
            excludes: getOsEnvOptional('APP_LOG_EXCLUDE', '').split(','),
            stack: getOsEnvBoolOptional('APP_LOG_STACK', false),
        },
    },
    policy: {
        token: {
        },
        redis: {
        },
        search: {
        },
        account: {
        },
        max: {
            page: {
                size: getOsEnvNumber('POLICY_MAX_PAGE_SIZE', 100),
            }
        },
        verify: {
        },
        test: {
        }
    },
};