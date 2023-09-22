import { BaseService } from '../../../common/base/base.service';
import { Builder } from 'builder-pattern';
import { ILog } from '../../../@types/log';
import tid from 'cls-rtracer';
import logger from '../../../lib/logger';
import maskdata from 'maskdata';
import { handleSentry, prune } from '../../../lib/utils';

const jsonMaskConfig4Log = {
    cardFields: ['credit', 'debit'],
    passwordFields: ['password', 'source', 'target'],
    phoneFields: ['phone', 'mobile'],
    stringMaskOptions:  {
        maskWith: "*",
        maskOnlyFirstOccurance: false,
    },
    stringFields: ['addr1', 'addr2', 'addr_state', 'addr_city'],
    uuidFields: ['uuid']
};

export default class LogService extends BaseService {
    filters: any;

    constructor(context) {
        super(context);

        this.filters = {
            'contacts': this.contacts,
        }
    }

    get = async (id) => {
        return { rows: [], count: 0 };
    };

    maskBody = (req, body) => {
        const _body = { ...body }
        if (_body.signup) {
            try {
                const signup = typeof _body.signup === 'string' ? JSON.parse(_body.signup) : _body.signup;
                _body.signup = maskdata.maskJSON2(signup, jsonMaskConfig4Log)
            } catch (e) {
                // JSON parse error 무시
                logger.error(e);
                handleSentry('error', e, req, _body)
            }
        }
        return maskdata.maskJSON2(_body, jsonMaskConfig4Log)
    }

    truncateResult = (result) => {
        let message = result?.message;
        if (message) {
            if (result?.detail?.message) {
                message += '\n';
                message += result?.detail?.message;
            }
        } else if (result?.detail?.message) {
            message = result?.detail?.message;
        }

        // log data 크기를 줄이기 위해서 array, object는 빈 값으로 대체
        const _result = { ...result };
        for (const key of Object.keys(_result)) {
            if (Array.isArray(_result[key])) {
                _result[key] = [];
            } else if (typeof _result[key] === 'object') {
                _result[key] = {};
            }
        }

        _result.message = message;

        return _result;
    }

    create = async (req: any, result: any) => {
        const path = req.originalUrl?.split('?')[0];
        const paths =  path.split('/').filter(e => e?.length > 0);
        const resource = paths?.length > 1 ? paths[1] : paths[0];

        if (resource === 'health') return;

        const token = req.locals?.access_token ?? undefined;
        const body = this.maskBody(req, req.body);
        const _result = this.truncateResult(result);

        const builder = Builder<ILog>()
            .resource(resource)
            .method(req.method)
            .action(req.locals?.action)
            .state(req.locals?.state)
            .resource_id(req.locals?.resource_id)
            .tenant_id(req.locals?.tenant_id)
            .receipt_no(req.locals?.receipt_no)
            .waybill_no(req.locals?.waybill_no)
            .path(path)
            .url(req.originalUrl)
            .headers(req.headers)
            .params(req.params)
            .query(req.query)
            .body(body)
            .code(result?.code)
            .message(_result?.message)
            .token(token)
            .ip_address(req.clientIp)
            .actor_id(req.user?._id || 0)
            .trace_uuid(tid.id() as string);

        const logData = prune(builder.build(), [ undefined ]);

        try {
            logger.api(logData);
        } catch (e) {
            logger.error(e);
            handleSentry('error', e, req, logData);
        }
    }

    accept = (data) => {
        if (!data) return false;
        const keys = Object.keys(this.filters);
        const resource = data?.resource;

        if (!keys.includes(resource)) return false;
        return this.filters[resource](data);
    }

    contacts = (data) => {
        return data && typeof data.state === 'string' && data.state?.length > 0
    }
}
