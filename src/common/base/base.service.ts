import ApiError from '../api.error';
import ApiCodes from '../api.codes';
import ApiMessages from '../api.messages';
import {assertNotNull, assertTrue, isValidId} from '../../lib/utils';
import {IContext} from '../../@types/context';
import {BaseController} from './base.controller';
import ApiHeaders from '../api.headers';
import {BaseCommon} from './base.common';
import {Transaction} from 'sequelize';

export abstract class BaseService extends BaseCommon {
    constructor(context: BaseController | BaseService | IContext = undefined) {
        super(context);
    }

    get env() {
        return this.environment;
    }

    get req() {
        return this.request;
    }

    protected getEnv = () => {
        return this.context ? this.context['env'] : {};
    };

    protected isErrorLogEnabled = () => {
        const headers = this.req?.headers || {};
        return headers[ApiHeaders.DEBUG_RESPONSE_ERROR_LOG] !== 'off';
    };

    /**
     * 지정한 tenant Id가 현재 사용자가 접근 가능하지 않은 경우 오류 발생
     * tenantId가 유효하지 않은 경우 오류 처리 하지 않음
     * tenantId 유효성 처리는 isValidId()로 별도 처리 필요함
     *
     * @param tenantId  접근 가능한 리소스인지 확인하기 위한 값
     * @param error     접근 가능하지 않은 경우 발생할 오류
     */
    protected assertTenantId = async (tenant_id: number, error = undefined) => {
        const isCrossTenantPermission = this.hasCrossTenantPermission();
        if (isCrossTenantPermission) {
            return;
        }

        const actor = this.getActor();
        const tenantId = tenant_id || actor.tenant_id;
        assertTrue(tenantId === actor.tenant_id, error);
    };

    /**
     * resource create 할때는 tenant id가 없을때 actor id로 설정한다.
     *
     * @param tenant_id
     */
    protected getValidTenantIdForCreate = async (tenantId: number) => {
        let result = tenantId;

        const actor = this.getActor();
        const isCrossTenantPermission = this.hasCrossTenantPermission();
        if (isCrossTenantPermission) {
            if (!isValidId(tenantId)) {
                result = actor.tenant_id;
            }
        } else {
            result = actor.tenant_id;
        }

        return result;
    };

    /**
     * resource를 read 할때는 tenant id가 없거나 권한이 없다면 오류 발생
     *
     * @param tenant_id
     */
    protected getValidTenantId = async (tenantId: number) => {
        const isCrossTenantPermission = this.hasCrossTenantPermission();
        if (isCrossTenantPermission) {
            return tenantId;
        }

        const actor = this.getActor();
        assertNotNull(actor, new ApiError(ApiCodes.NOT_FOUND, ApiMessages.NOT_FOUND, {
            message: `The actor is invalid`
        }));

        return actor.tenant_id;
    };

    protected assertNotSelfUpdate = (actorId: number, targetId: number) => {
        const isSuperUser = this.hasSuperUserPermission();
        if (!isSuperUser) return;

        assertTrue(actorId !== targetId, new ApiError(ApiCodes.BAD_REQUEST, ApiMessages.BAD_REQUEST, {
            message: `The actor(${actorId}) cannot change self state`
        }));
    };

    protected hasActor = () => {
        return this.actor;
    };

    isOwnTransaction = (transaction: Transaction) => {
        return transaction && !this.transaction;
    }

    getTransaction = () => {
        return this.transaction;
    }

    protected getSystemName = () => {
        if (!this.actor) return undefined;

        return this.actor.tenant_id === 1 ? 'cbt' : 'oms';
    }

    isCbt = () => {
        if (!this.actor) return undefined;
        const sys = this.getSystemName();

        return sys === 'cbt';
    }

    isOms = () => {
        if (!this.actor) return undefined;
        const sys = this.getSystemName();

        return sys === 'oms';
    }
}
