import logger from '../../lib/logger';
import {Transaction} from 'sequelize';
import {BaseCommon} from './base.common';
import {IContext} from '../../../src/@types/context';
import LogService from "../../api/v1/logs/log.service";

export abstract class BaseController extends BaseCommon {
    protected request: any = {};
    protected environment: any = {};

    protected tenantId: number;
    protected context: IContext;
    protected traceUuid: string;
    protected transaction: Transaction = undefined;

    constructor(context = undefined) {
        super(context);
    }

    get env() {
        return this.environment;
    }

    get req() {
        return this.request;
    }

    protected handleError(req, err) {
        // Sentry Quota 관리를 위해서 필요한 경우에만 오류 처리하도록 개선 필요
    }

    public extractAuthToken = (req): string => {
        let token;

        const authorization = req.headers?.authorization;
        if (authorization) {
            logger.debug(`[${req.prefix}] authorization:`, req.headers.authorization);
            const bearer = authorization.split(' ');
            token = bearer[1];
        }

        return token;
    };

    protected extractParams = (req) => {
        if (!req?.params) return {};

        return {
        };
    };

    protected extractQuery = (req) => {
        if (!req?.query) return {};

        return {
        };
    };

    protected extractBody = (req) => {
        if (!req?.body) return {};

        return {
        }
    }

    public getContext = (): IContext => {
        return this.context;
    }

    protected isErrorLogEnabled = () => {
        return this.getContext()?.error_log !== 'off'
    }

    protected setLogVariables = (req, data) => {
        req.locals = { ...req.locals, ...data };
    }

    protected response = async (req, res, httpCode, result) => {
        try {
            await new LogService(this).create(req, result);
        } catch (e) {
            logger.error(e);
        }

        res?.status(httpCode).json(result);
    }


}
