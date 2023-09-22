import logger from '../../../lib/logger';
import httpStatus from 'http-status';
import * as Sentry from '@sentry/node';
import { BaseController } from '../../../common/base/base.controller';
import { Result } from '../../../common/result';

export default class LogController extends BaseController {
    get = async (req, res, next) => {
        let result;

        try {
            result = Result.ok<any>({
                count: 0,
                logs: [],
            }).toJson();

        } catch (e) {
            if (this.isErrorLogEnabled()) {
                logger.error(e);
            }
            Sentry.captureException(e, {
                extra: {
                    params: req.params,
                    query: req.query,
                    body: req.body
                }
            });

            result = Result.fail<Error>(e).toJson();
        }

        logger.res(httpStatus.OK, result, req);
        await this.response(req, res, httpStatus.OK, result);
    };
}
