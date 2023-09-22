import * as dotenv from 'dotenv';
import * as path from 'path';

import * as pkg from '../package.json';
import {
    getOsEnv,
    getOsEnvNumber,
    getOsEnvOptional,
    normalizePort
} from './lib/env';
import appRoot from 'app-root-path';
import fs from 'fs';
import * as process from 'process';

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
            process.exit(1);
        }
    } catch(err) {
        console.error(process.env.NODE_ENV, JSON.stringify(config), err);
        process.exit(1);
    }
})();

dotenv.config(config);

/**
 * Environment variables
 */
const env = {
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
                email: getOsEnv('ROOT_EMAIL'),
                name: getOsEnv('ROOT_NAME'),
                password: getOsEnv('ROOT_PASSWORD'),
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
        schema: getOsEnv('MYSQL_SCHEMA'),
        port: getOsEnv('MYSQL_PORT'),
        write: {
            host: getOsEnv('MYSQL_WRITE_HOST'),
            username: getOsEnv('MYSQL_WRITE_USERNAME'),
            password: getOsEnv('MYSQL_WRITE_PASSWORD'),        },
        read: {
            host: getOsEnv('MYSQL_READ_HOST'),
            username: getOsEnv('MYSQL_READ_USERNAME'),
            password: getOsEnv('MYSQL_READ_PASSWORD'),
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
    },
    policy: {
        token: {
            access: {
                expire: getOsEnv('POLICY_TOKEN_ACCESS_EXPIRE'),
            },
            refresh: {
                expire: getOsEnv('POLICY_TOKEN_REFRESH_EXPIRE'),
            },
            issue: {
                margin: getOsEnvNumber('POLICY_TOKEN_ISSUE_MARGIN', 100),
            }
        },
        redis: {
            sync: {
                count: getOsEnvNumber('POLICY_REDIS_SYNC_COUNT', 100),
            }
        },
    }
};

export default env;
