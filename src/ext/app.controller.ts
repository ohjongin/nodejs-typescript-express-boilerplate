import { BaseController } from '../common/base/base.controller';
import httpStatus from 'http-status';
import { Result } from '../common/result';
import logger from '../lib/logger';
import AppService from './app.service';
import { handleSentry } from '../lib/utils';

export default class AppController extends BaseController {
    health = async (req, res) => {
        const { items } = req.query;
        if (items) {
            await this.descHealth(req, res);
        } else {
            res.status(httpStatus.OK).json({});
        }
    }

    descHealth = async (req, res) => {
        this.setContext(req);
        let statusCode: number = httpStatus.OK;
        let result;
        try {
            const info = await new AppService(this).describeHealthInfo();
            result = Result.ok(info).toJson();
        } catch (e) {
            if (this.isErrorLogEnabled()) {
                logger.error(e);
            }
            this.handleError(req, e);
            handleSentry('fatal', e, req);

            statusCode = httpStatus.INTERNAL_SERVER_ERROR;
            result = Result.fail<Error>(e).toJson();
        }

        logger.res(statusCode, result, req);
        await this.response(req, res, statusCode, result);
    }
}
