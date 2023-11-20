import { env } from '../env';
import fs from 'fs';
import logger from '../lib/logger';
import { handleSentry } from '../lib/utils';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { app } from '../app';
import { build, version } from '../../package.json';

export const initSentry = () => {
    if (env.app.sentry.dsn?.length < 1) return;

    let version = '', build = '';
    try {
        const data = fs.readFileSync('package.json', { encoding: 'utf8', flag: 'r' });
        const pkg = JSON.parse(data);
        version = pkg.version;
        build = pkg.build;
    } catch(e) {
        logger.error(e);
        handleSentry('error', e);
    }

    Sentry.init({
        dsn: env.app.sentry.dsn,
        integrations: [
            // Add profiling integration to list of integrations
            new ProfilingIntegration(),
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
        release: `${version}@${build}`,
    });

    // RequestHandler creates a separate execution context using domains, so that every
    // transaction/span/breadcrumb is attached to its own Hub instance
    app.use(Sentry.Handlers.requestHandler());
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
    app.use(Sentry.Handlers.requestHandler());
}

export const finalizeSentry = () =>{
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
    } else {
        app.use(function onError(err, req, res, next) {
            logger.error(`Unhandled errors`);
            res.statusCode = 500;
            res.end(`Unhandled errors`);
        });
    }
}