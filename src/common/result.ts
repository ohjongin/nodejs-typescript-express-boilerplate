import ApiCode from './api.codes';
import ApiMessages from './api.messages';
import context from 'express-http-context';
import ApiHeaders from './api.headers';
import i18next from 'i18next';
import tid from 'cls-rtracer';
import { env } from '../env';
import dayjs from 'dayjs';
import ip from 'ip';
import os from 'os';
import { encryptSimple } from '../lib/crypto';

export class Result<T> {
    public isSuccess: boolean;
    public error: any;
    private readonly _value: T;

    private constructor (isSuccess: boolean, error?: string, value?: T) {
        if (isSuccess && error) {
            throw new Error(`InvalidOperation: A result cannot be successful and contain an error`);
        }
        if (!isSuccess && !error) {
            throw new Error(`InvalidOperation: A failing result needs to contain an error message`);
        }

        this.isSuccess = isSuccess;
        this.error = error;
        this._value = value;

        Object.freeze(this);
    }

    public getValue () : T {
        return this._value;
    }

    get json() {
        const clientIp = context.get('client_ip');
        const error = this.error;
        const errResponse = context.get(ApiHeaders.DEBUG_RESPONSE_ERROR_DETAIL);
        const isVerbose = errResponse ? errResponse?.includes('verbose') : (env.mode.test || ['112.170.6.254'].includes(clientIp));

        if (isVerbose && this.error && !this.isSuccess) {
            const detail = error?.detail;
            this.error.detail = isVerbose ? {
                ...detail,
                ...{
                    req: error?.req,
                    location: error?.__file__ && `${error?.__file__}:${error?.__line__} (${error?.__function__})`,
                    trace: error?.stack,
                    version: error?.version,
                    build: error?.build,
                }
            } : detail;
        }

        const payload = {
            name: os.hostname(),
            private: ip.address(),
        };

        const host = encryptSimple(JSON.stringify(payload))

        return this.isSuccess ? {
            code: ApiCode.OK,
            message: i18next.t(ApiMessages.OK),
            result: this._value,
            host,
            timestamp: dayjs().format(),
            tid: tid.id()
        } : {
            code: this.error?.code || ApiCode.INTERNAL_SERVER_ERROR,
            message: i18next.exists(error?.message) ? i18next.t(error?.message) : error?.message,
            detail: isVerbose? error?.detail : {
                message: error?.detail?.message,
                code: error?.detail?.code,
            },
            host,
            timestamp: dayjs().format(),
            tid: tid.id()
        };
    }

    public toJson() {
        return this.json;
    }

    public static ok<U> (value?: U) : Result<U> {
        return new Result<U>(true, null, value);
    }

    public static fail<U> (error): Result<U> {
        return new Result<U>(false, error);
    }

    public static combine (results: Result<any>[]) : Result<any> {
        for (const result of results) {
            if (!result.isSuccess) return result;
        }
        return Result.ok<any>();
    }
}
