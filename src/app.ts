import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import tid from 'cls-rtracer';
import context from 'express-http-context';
import * as Api from './app.router';
import logger from './lib/logger';
import env from './env';
import bodyParser from 'body-parser';
import appRoot from 'app-root-path';
import path from 'path';
import * as mysql from './lib/mysql';
import * as requestIp from 'request-ip';
import * as Sentry from '@sentry/node';
import { build, version } from '../package.json';
import i18next from 'i18next';
import i18nextMiddleware from 'i18next-http-middleware';
import Backend from 'i18next-fs-backend';
import ApiHeaders from './common/api.headers';
import { jsonMaskConfig, prune, removeSensitiveValues } from './lib/utils';
import helmet from 'helmet';
import * as process from 'process';
import { isMasterProcess } from 'pm2-master-process';
import UAParser from 'ua-parser-js';
import ms from 'ms';
import maskdata from 'maskdata';
import ip from 'ip';
import parser from 'accept-language-parser';
// import { ProfilingIntegration } from '@sentry/profiling-node';

export const app = express();
export const comsat = express(); // communications satellite
export const appPath = __dirname;

const supportLanguages = ['ko', 'en', 'jp', 'ja'];

if (env.app.sentry.dsn?.length > 0) {
    Sentry.init({
        dsn: env.app.sentry.dsn,
        integrations: [
            // Add profiling integration to list of integrations
            // new ProfilingIntegration(),
            // enable HTTP calls tracing
            new Sentry.Integrations.Http({ tracing: true }),
            // enable Express.js middleware tracing
            new Sentry.Integrations.Express({ app }),
            new Sentry.Integrations.Mysql(),
            // Automatically instrument Node.js libraries and frameworks
            ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
        ],
        tracesSampleRate: 0.1,
        profilesSampleRate: 0.1,
        normalizeDepth: 11,
        environment: env.mode.value,
        enabled: env.mode.prod || env.mode.dev,
    });

    // RequestHandler creates a separate execution context using domains, so that every
    // transaction/span/breadcrumb is attached to its own Hub instance
    app.use(Sentry.Handlers.requestHandler());
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
}

i18next
    .use(Backend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
        backend: {
            loadPath: __dirname + '/locales/{{lng}}/{{ns}}.json',
        },
        detection: {
            order: ['querystring', 'cookie'],
            caches: ['cookie'],
        },
        fallbackLng: supportLanguages,
        preload: supportLanguages,
    });

app.set('views', path.join(appRoot.path, '/views'));
app.set('view engine', 'ejs');

function getOrigins() {
    const origins = env.app.cors.origins?.split(',') || [];
    logger.info('origins:', JSON.stringify(origins));
    return origins;
}

async function setContext(req) {
    const { method, url, clientIp, headers, body, params, query, cookies } = req;
    const userAgent = headers['user-agent'];

    // 비밀번호가 log에 남는 것을 방지하기 위한 코드
    const _body = maskdata.maskJSON2(body, jsonMaskConfig);
    const _params = prune(removeSensitiveValues({ ...params }));
    const _query = prune(removeSensitiveValues({ ...query }));

    const reqInfo = {
        method,
        url,
        host_ip: ip.address(),
        baseUrl: req.baseUrl,
        path: req.path,
        originalUrl: req.originalUrl,
        ua: new UAParser(userAgent),
        body: _body,
        params: _params,
        query: _query,
        userAgent,
    }

    if (!url?.startsWith('/health')) {
        logger.info(`body:${JSON.stringify(_body)} params:${JSON.stringify(_params)} query: ${JSON.stringify(_query)} cookie:${JSON.stringify(cookies)}`);
        logger.req(req);
    }

    // accept-language: en-US,en;q=0.9,ko;q=0.8
    const languages = headers['x-language'] || headers['accept-language'] || 'ko';
    const language = parser.pick(supportLanguages, languages);

    req.env = env;
    req.tid = tid.id();
    req.timestamp = new Date();
    req.prefix = `${req.method} ${path.join(req.baseUrl, req.path)}`;
    req.language = language;

    const force = headers[ApiHeaders.ACTION_BY_FORCE];
    if (force) context.set(ApiHeaders.ACTION_BY_FORCE, force);

    context.set('language', language);
    context.set('req_prefix', req.prefix);
    context.set('client_ip', clientIp);
    context.set('tid', tid.id());
    context.set('req_info', reqInfo);
    context.set(ApiHeaders.DEBUG_RESPONSE_ERROR_DETAIL, headers[ApiHeaders.DEBUG_RESPONSE_ERROR_DETAIL]);

    if (env.mode.prod) return;

    // Debug mode only
    context.set('host', headers['host']);
    context.set('origin', headers['origin']);
    context.set('caller', headers['x-caller']);
}

async function setLanguage(lang: string) {
    if (i18next.languages?.includes(lang)) {
        await i18next.changeLanguage(lang);
        // if (!env.mode.prod) logger.debug(`i18next.changeLanguage: ${lang}`);
    } else {
        await i18next.changeLanguage('ko');
    }
}

async function preprocessor(req, res, next) {
    const { url, headers } = req;

    try {
        await setContext(req);
        await setLanguage(req.language);

        Sentry.setTag('tid', tid.id() as string);
        Sentry.setTag('host', req.get('host'));

        if (!req.env.mode.prod && !url?.startsWith('/health')) {
            logger.debug(`headers: ${JSON.stringify(headers)}`);
            logger.debug(`languages: ${JSON.stringify(i18next.languages)}`);
        }
    } catch (e) {
        logger.error(e);
    }
    next();
}

// https://1004lucifer.blogspot.com/2019/04/axios-response-headers-content.html
app.use(
    cors({
        origin: getOrigins(),
        exposedHeaders: ['Content-Disposition'],
        credentials: true,
    })
);
app.use(helmet());
// RequestHandler creates a separate execution context using domains, so that every
// transaction/span/breadcrumb is attached to its own Hub instance
app.use(Sentry.Handlers.requestHandler());
app.use(express.static(path.join(appRoot.path, '/public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: '8mb' }));
app.use(bodyParser.json({ limit: '8mb' }));
app.use(bodyParser.raw());
app.use(requestIp.mw());
app.use(tid.expressMiddleware());
app.use(context.middleware);
app.use(i18nextMiddleware.handle(i18next));
app.use(preprocessor);
app.use((req, res, next) => {
    res.on('finish', () => {
        // console.log(`[${req.method}] ${req.originalUrl} [FINISHED]`)
    });

    res.on('close', () => {
        // console.log(`[${req.method}] ${req.originalUrl} [CLOSED]`)
    });

    next();
});
app.use(Api.path, Api.router);

if (env.app.sentry.dsn?.length > 0) {
    // The error handler must be before any other error middleware and after all controllers
    app.use(Sentry.Handlers.errorHandler());
    // Optional fallthrough error handler
    app.use(function onError(err, req, res, next) {
        // The error id is attached to `res.sentry` to be returned
        // and optionally displayed to the user for support.
        logger.error(JSON.stringify(res.sentry));
        res.statusCode = 500;
        res.end(res.sentry + "\n");
    });

    Sentry.setTag('build', build || version);
}

const appMain = async () => {
    logger.init({
        log: true,
        sql: true,
        net: true,
        debug: true,
        error: true,
        fatal: true,
        console: false,
    });

    const pmId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
    const isMaster = await isMasterProcess();
    const worker = isMaster ? 'master' : 'worker';
    logger.debug(`[${pmId}:${worker}][ v${build || version}, ${env.mode.value}, ${JSON.stringify(env.config)} ] =========================================`);

    await mysql.connect();

    logger.debug(`[${pmId}:${worker}] ----------------------------------------------------------------------------`);
    logger.debug(`[${pmId}:${worker}] 🚀 App listening on the port ${env.app.port}`);
    logger.debug(`[${pmId}:${worker}]    env.policy.token.access.expire:  ${env.policy.token.access.expire}, ${ms(env.policy.token.access.expire)}s`);
    logger.debug(`[${pmId}:${worker}]    env.policy.token.refresh.expire: ${env.policy.token.refresh.expire}, ${ms(env.policy.token.refresh.expire)}s`);
    logger.debug(`[${pmId}:${worker}]    env: ${JSON.stringify(env, null, 2)}`);
    logger.debug(`[${pmId}:${worker}] ============================================================================`);

    console.log(`${new Date().toISOString()} [${pmId}:${worker}][ v${build || version}, ${env.mode.value} ] =================================== READY !!!`);
}

app.listen(env.app.port, appMain);
