import winston from 'winston';
import context from 'express-http-context';
import DailyRotateFile from 'winston-daily-rotate-file';
import appRoot from 'app-root-path';
import tid from 'cls-rtracer';
import path from 'path';
import { getFileInfo, jsonMaskConfig, prune } from './utils';
import * as stackTraceParser from 'stacktrace-parser';
import env from '../env';
import fs from 'fs';
import * as process from 'process';
import maskdata from 'maskdata';
import dayjs from "dayjs";

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

const MESSAGE = Symbol.for('message');
const jsonFormatter = (logEntry) => {
    try {
        const module = '/' + path.basename(appRoot.path) + '/';
        const boilerplateLines = (line) => {
            return line && module && line.file.indexOf(module) && line.file.indexOf('/node_modules/') < 0;
        };

        const pkg = packageInfo;
        const clientIp = getContext('client_ip');
        const reqInfo = getContext('req_info');
        const username = getContext('username');

        const parsed = stackTraceParser.parse(new Error().stack);
        const stacks = parsed.filter(boilerplateLines);
        const stack = Array.isArray(stacks) && stacks.length > 2 ? stacks[2] : undefined;
        const func = stack?.methodName;
        const line = stack?.lineNumber;
        const file = path.basename(stack?.file);
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

        // https://docs.aws.amazon.com/athena/latest/ug/data-types.html
        const base = {
            datetime: dayjs().format("YYYY-MM-DD HH:mm:ss.SSS"),
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
            stack: logEntry.level === 'error' ? logEntry?.message[0]?.stack || stacks : undefined,
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            day: new Date().getDate(),
            timestamp: new Date().getTime(),
        };

        const json = Object.assign(base, logEntry);
        logEntry[MESSAGE] = JSON.stringify(json);
    } catch (e) {
        console.error(e);
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
    new DailyRotateFile({ ...drfOpt, ...{ level: 'debug', filename: `sql.%DATE%.${pmId}.log` } })
];

const transportsApi = [
    // 콘솔로그찍을 때만 색넣자.
    // new winston.transports.Console(consoleOpts),
    // 모든 레벨 로그를 저장할 파일 설정
    new DailyRotateFile({ ...drfOpt, ...{ level: 'debug', filename: `api.%DATE%.${pmId}.log` } })
];

const general = winston.createLogger({
    level: 'debug',
    levels,
    // format: logFormat,
    // format: winston.format.json(),
    format: winston.format(jsonFormatter)(),
    defaultMeta: {},
    transports: transportsGeneral
});

const http = winston.createLogger({
    level: 'http',
    levels,
    // format: logFormat,
    // format: winston.format.json(),
    format: winston.format(jsonFormatter)(),
    defaultMeta: {},
    transports: transportsHttp
});

const sql = winston.createLogger({
    level: 'debug',
    levels,
    // format: logFormat,
    // format: winston.format.json(),
    format: winston.format(jsonFormatter)(),
    defaultMeta: {},
    transports: transportsSql
});

const api = winston.createLogger({
    level: 'debug',
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

        const configSql = { ...config, ...{ debug: config.sql }};
        const configNet = { ...config, ...{ debug: config.net }};

        general.transports.forEach(t => silent(t, config));
        sql.transports.forEach(t => silent(t,  configSql));
        http.transports.forEach(t => silent(t, configNet));
    },
    log: (...args) => {
        return general.debug(args);
    },
    debug: (...args) => {
        return general.debug(args);
    },
    info: (...args) => {
        return general.info(args);
    },
    error: (...args) => {
        return general.error(args);
    },
    http: (...args) => {
        return http.http(args);
    },
    res: (...args) => {
        return http.http(args);
    },
    sql: (...args) => {
        return sql.debug(args);
    },
    api: (...args) => {
        return api.debug(args);
    },
    req: (...args) => {
        return general.debug(args);
    }
};

export default logger;