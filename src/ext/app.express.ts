import cors from 'cors';
import { env } from '../env';
import logger from '../lib/logger';
import helmet from 'helmet';
import { app, appPath } from '../app';
import express from 'express';
import appRoot from 'app-root-path';
import path from 'path';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import i18nextMiddleware from 'i18next-http-middleware';
import * as requestIp from 'request-ip';
import i18next from 'i18next';
import tid from 'cls-rtracer';
import context from 'express-http-context';
import maskdata from 'maskdata';
import { jsonMaskConfig, prune } from '../lib/utils';
import ip from 'ip';
import UAParser from 'ua-parser-js';
import parser from 'accept-language-parser';
import ApiHeaders from '../common/api.headers';
import * as Sentry from '@sentry/node';
import * as Api from './app.router';
import Backend from 'i18next-fs-backend/cjs';
import { removeSensitiveValues } from '../lib/model.util';

const supportLanguages = ['ko', 'en', 'jp', 'ja'];

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
            logger.info(`headers: ${JSON.stringify(headers)}`);
            logger.info(`languages: ${JSON.stringify(i18next.languages)}`);
        }
    } catch (e) {
        logger.error(e);
    }
    next();
}

export const initExpress = () => {
    i18next
        .use(Backend)
        .use(i18nextMiddleware.LanguageDetector)
        .init({
            backend: {
                loadPath: path.join(appPath, '/locales/{{lng}}/{{ns}}.json'),
            },
            detection: {
                order: ['querystring', 'cookie'],
                caches: ['cookie'],
            },
            fallbackLng: supportLanguages,
            preload: supportLanguages,
        });

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
}