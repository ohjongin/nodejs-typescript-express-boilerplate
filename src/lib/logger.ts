import winston from 'winston';
import context from 'express-http-context';
import DailyRotateFile from 'winston-daily-rotate-file';
import appRoot from 'app-root-path';
import tid from 'cls-rtracer';
import path from 'path';
import { getFileInfo, handleSentry, isValidArray, jsonMaskConfig, prune } from './utils';
import * as stackTraceParser from 'stacktrace-parser';
import { env } from '../env';
import fs from 'fs';
import * as process from 'process';
import { format } from 'date-fns';
import maskdata from 'maskdata';

const { combine, timestamp, colorize, printf } = winston.format;

const logDir = path.join(appRoot.path, 'logs');
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
};
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white'
};
winston.addColors(colors);

const packageStr = fs.readFileSync(path.join(appRoot.path, 'package.json'), { encoding: 'utf8', flag: 'r' });
let packageInfo = undefined;
try {
    if (packageStr) packageInfo = JSON.parse(packageStr);
} catch (e: any) {
    console.error(getFileInfo(), e.message, packageStr);
}

const getContext = (key) => {
    try {
        return context.get(key);
    } catch (e) {
        console.error(e);
    }

    return undefined;
}

const parseLogEntry = (logEntry) => {
    const module = '/' + path.basename(appRoot.path) + '/';
    const boilerplateLines = (line) => {
        return line && module && line.file.indexOf(module) && line.file.indexOf('/node_modules/') < 0 && line.file.indexOf('node:internal/') < 0;
    };

    let stack;
    let message;
    const messages = logEntry['message'];
    if (logEntry['error'] instanceof Error) {
        stack = logEntry['error'].stack;
        message = logEntry['error'].message;
    } else if (messages?.length > 0) {
        stack = messages[messages.length - 1];
        message = messages.slice(0, messages.length - 1);
    } else {
        stack = new Error().stack
        message = messages;
    }

    const parsed = stackTraceParser.parse(stack);
    const stacks = parsed.filter(boilerplateLines).filter(line => {
        return line.file.indexOf('/lib/logger.ts') < 0 && line.file.indexOf('<anonymous>') < 0
    });
    const location = isValidArray(stacks) ? stacks[0] : parsed[1];
    const func = location?.methodName ? location?.methodName : 'invalid';
    const line = location?.lineNumber? location?.lineNumber : 'invalid';
    const file = location?.file ? path.basename(location?.file) : 'invalid';

    const pkg = packageInfo;
    const clientIp = getContext('client_ip');
    const reqInfo = getContext('req_info');
    const username = getContext('username');

    const result = {
        reqInfo, file, line, func, clientIp, pkg, username, stacks, parsed, request: undefined, response: undefined, message
    };

    if (env?.app?.log?.stack !== true) {
        result.stacks = logEntry.level === 'error' ? stacks : undefined;
        result.parsed = undefined;
    }

    return result;
}

const payload = (body) => {
    const { reqInfo, file, line, func, clientIp, pkg, username, request, response, stacks, parsed, message } = body;

    // https://docs.aws.amazon.com/athena/latest/ug/data-types.html
    return {
        datetime: format(new Date(), "yyyy-MM-dd HH:mm:ss.SSS"),
        tid: tid.id(),
        method: reqInfo?.method,
        path: reqInfo?.path,
        file: `${file}:${line}`,
        func,
        ip: clientIp,
        host_ip: reqInfo?.host_ip,
        version: pkg?.version,
        build: pkg?.build,
        ua: prune(reqInfo?.ua),
        ua_str: reqInfo?.userAgent,
        pm_id: process.env.pm_id || 0,
        url: reqInfo?.originalUrl,
        username,
        request,
        response,
        stacks,
        parsed,
        message,
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        day: new Date().getDate(),
        timestamp: new Date().getTime(),
    };
}

const getMessage = (logEntry) => {
    try {
        const { reqInfo, file, line, func, clientIp, pkg, username, stacks, parsed, message } = parseLogEntry(logEntry);

        const base = payload({
            reqInfo, file, line, func, clientIp, pkg, username,  stacks, parsed, message
        });

        const result = Object.assign(base, logEntry);
        result.message = isValidArray(message) ? message : [ message ];
        return JSON.stringify(result);
    } catch (e) {
        console.error(e);
        handleSentry('error', e, undefined, {
            logEntry,
        });
    }

    return logEntry[MESSAGE];
}

const MESSAGE = Symbol.for('message');
const generalFormatter = (logEntry) => {
    try {
        logEntry[MESSAGE] = getMessage(logEntry);
    } catch (e) {
        console.error(e);
        handleSentry('error', e, undefined, {
            message: logEntry['message'],
            logEntry
        })
    }

    return logEntry;
};

const sqlFormatter = (logEntry) => {
    try {
        logEntry[MESSAGE] = getMessage(logEntry);
    } catch (e) {
        console.error(e);
        handleSentry('error', e)
    }

    return logEntry;
};

const httpFormatter = (logEntry) => {
    try {
        const { reqInfo, file, line, func, clientIp, pkg, username, stacks } = parseLogEntry(logEntry);

        if (env.app.log.excludes.includes(file)) return false;

        let request, response;
        if (logEntry.level === 'http') {
            const message = logEntry?.message;
            // Circular JSON 오류 방어코드
            delete logEntry.message;

            request = (Array.isArray(message) && message.length > 2) ? {} : undefined;
            response = (Array.isArray(message) && message.length > 1) ? prune(message[1]) : undefined;

            if (request) {
                const req = message[2];
                request.timestamp = req?.timestamp || req?._startTime;
                request.path = req?.originalUrl;
                request.method = req?.method;
                request.query = req?.query;
                request.params = req?.params;
                request.body = maskdata.maskJSON2(req?.body, jsonMaskConfig);
                request.headers = req?.headers;
                request.ua = req?.rawHeaders['User-Agent'];
                request.user = req.user;
            }

            if (response) {
                response.timestamp = new Date();
                response.duration = response.timestamp?.getTime() - response.timestamp?.getTime();
            }
        }

        const base = payload({
            reqInfo, file, line, func, clientIp, pkg, username, request, response, stacks
        })

        const result = Object.assign(base, logEntry);
        logEntry[MESSAGE] = JSON.stringify(result);
    } catch (e) {
        console.error(e);
        handleSentry('error', e)
    }

    return logEntry;
};

// 콘솔에 찍힐 때는 색깔을 구변해서 로깅해주자.
const consoleOpts = {
    handleExceptions: true,
    level: env.mode.prod ? 'error' : 'debug',
    format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' })
    )
};

export const filter = {
    log: true,
    api: true,
    aws: true,
    sql: true,
    net: true,
    debug: true,
    error: true,
    fatal: true,
    console: false
};

const pmId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
const drfOpt = {
    datePattern: 'YYYYMMDD',
    dirname: logDir,
    zippedArchive: true
};
const transportsGeneral = [
    // 콘솔로그찍을 때만 색넣자.
    new winston.transports.Console(consoleOpts),
    // error 레벨 로그를 저장할 파일 설정
    new DailyRotateFile({ ...drfOpt, ...{ level: 'error', filename: `err.%DATE%.${pmId}.log` } }),
    new DailyRotateFile({ ...drfOpt, ...{ level: 'debug', filename: `app.%DATE%.${pmId}.log` } }),
    // 모든 레벨 로그를 저장할 파일 설정
    new DailyRotateFile({ ...drfOpt, ...{ level: 'info', filename: `inf.%DATE%.${pmId}.log` } })
];

const transportsHttp = [
    // 콘솔로그찍을 때만 색넣자.
    new winston.transports.Console(consoleOpts),
    new DailyRotateFile({ ...drfOpt, ...{ level: 'http', filename: `net.%DATE%.${pmId}.log` } })
];

const transportsSql = [
    // 콘솔로그찍을 때만 색넣자.
    new winston.transports.Console(consoleOpts),
    // 모든 레벨 로그를 저장할 파일 설정
    new DailyRotateFile({ ...drfOpt, ...{ level: 'silly', filename: `sql.%DATE%.${pmId}.log` } })
];

const transportsApi = [
    // 콘솔로그찍을 때만 색넣자.
    // new winston.transports.Console(consoleOpts),
    // 모든 레벨 로그를 저장할 파일 설정
    new DailyRotateFile({ ...drfOpt, ...{ level: 'silly', filename: `api.%DATE%.${pmId}.log` } })
];

const transportsAws = [
    // 콘솔로그찍을 때만 색넣자.
    // new winston.transports.Console(consoleOpts),
    // 모든 레벨 로그를 저장할 파일 설정
    new DailyRotateFile({ ...drfOpt, ...{ level: 'silly', filename: `aws.%DATE%.${pmId}.log` } })
];

const transportsEtc = [
    // 콘솔로그찍을 때만 색넣자.
    // new winston.transports.Console(consoleOpts),
    // 모든 레벨 로그를 저장할 파일 설정
    new DailyRotateFile({ ...drfOpt, ...{ level: 'silly', filename: `etc.%DATE%.${pmId}.log` } })
];

const general = winston.createLogger({
    level: 'general',
    levels,
    format: winston.format(generalFormatter)(),
    transports: transportsGeneral
});

const http = winston.createLogger({
    level: 'http',
    levels,
    format: winston.format(httpFormatter)(),
    transports: transportsHttp
});

const sql = winston.createLogger({
    level: 'sql',
    levels,
    format: winston.format(sqlFormatter)(),
    transports: transportsSql
});

const aws = winston.createLogger({
    level: 'aws',
    levels,
    format: winston.format(generalFormatter)(),
    transports: transportsAws
});

const etc = winston.createLogger({
    level: 'etc',
    levels,
    format: winston.format(generalFormatter)(),
    transports: transportsEtc
});

const api = winston.createLogger({
    level: 'api',
    levels,
    format: combine(
        timestamp(),
        printf(({ message, timestamp }) => {
            let body = message;
            if (Array.isArray(message) && message.length > 0) body = message[0];
            delete body['trace_uuid'];
            body['tid'] = tid.id();
            body['timestamp'] = timestamp;
            return JSON.stringify(body);
        })
    ),
    defaultMeta: {},
    transports: transportsApi
});

const silent = (t, config) => {
    // @ts-ignore
    const options = t.options;
    // @ts-ignore
    if (t.name === 'console') t.silent = !config.console;
    else if (options) {
        switch (options?.level) {
            case 'error':
                t.silent = !config.error;
                break;
            case 'info':
                t.silent = !config.info;
                break;
            case 'debug':
                t.silent = !config.debug;
                break;
            default:
                t.silent = !config.log
                break;
        }
    } else t.silent = !config.log
}

const logger = {
    init: (...args) => {
        const config = Array.isArray(args) && args.length > 0 ? args[0] : undefined;
        if (!config) return;

        const configSql = { ...config, ...{ silly: config.sql }};
        const configNet = { ...config, ...{ silly: config.net }};

        general.transports.forEach(t => silent(t, config));
        sql.transports.forEach(t => silent(t,  configSql));
        http.transports.forEach(t => silent(t, configNet));
        sql.transports.forEach(t => silent(t, configNet));
        api.transports.forEach(t => silent(t, configNet));
        aws.transports.forEach(t => silent(t, configNet));
    },
    log: (...args) => {
        args.push(new Error().stack);
        return general.debug(args);
    },
    debug: (...args) => {
        args.push(new Error().stack);
        return general.debug(args);
    },
    info: (...args) => {
        args.push(new Error().stack);
        return general.info(args);
    },
    error: (...args) => {
        args.push(new Error().stack);
        return general.error(args);
    },
    http: (...args) => {
        args.push(new Error().stack);
        return http.http(args);
    },
    res: (...args) => {
        args.push(new Error().stack);
        return http.http(args);
    },
    sql: (...args) => {
        args.push(new Error().stack);
        return sql.debug(args);
    },
    api: (...args) => {
        args.push(new Error().stack);
        return api.debug(args);
    },
    aws: (...args) => {
        args.push(new Error().stack);
        return aws.debug(args);
    },
    etc: (...args) => {
        args.push(new Error().stack);
        return etc.debug(args);
    },
    req: (...args) => {
        args.push(new Error().stack);
        args.push('req');
    }
};

export default logger;