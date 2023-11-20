import { IUser } from '../../@types/user';
import { assertTrue, parseIntSafe } from '../../lib/utils';
import { Transaction } from 'sequelize';
import tid from 'cls-rtracer';
import { IPermission } from '../../@types/permission';
import {IContext} from "../../@types/context";

export abstract class BaseCommon {
    protected request: any = {};
    protected environment: any = {};

    protected _id: number;
    protected _instance?: any;
    protected tenantId: number;
    protected userId: number;
    protected actor: IUser;
    protected transaction: Transaction = undefined
    protected context: IContext;
    protected permissions: IPermission[];
    protected isForce = false;
    protected traceUuid: any;

    constructor(context: BaseCommon | IContext | any = undefined) {
        if (!context) return;

        // noinspection DuplicatedCode
        if (context) {
            this.context = typeof context.getContext === 'function' ? context.getContext() : undefined;
            this.request = context?.req;
            this.environment = context?.env;

            this.actor = typeof context.getActor === 'function' ? context.getActor() : undefined;
            this.transaction = typeof context.getTransaction === 'function' ? context.getTransaction() : undefined;
            this.traceUuid = tid.id();
        } else {
            this.context = context;
            this.traceUuid = tid.id();
        }
    }

    public getActor = (): IUser => {
        return this.actor;
    }

    protected getActorId = (): number => {
        const actorId = this.getActor()?._id || this.userId || this._id;
        return (actorId === undefined && this.isForce) ? 0 : actorId;
    }

    public setId = (id: number) => {
        return this.setActorId(id);
    };

    public setActorId = (id: number) => {
        this._id = parseIntSafe(id);
        return this;
    };

    public setInstance = (instance: any) => {
        this._instance = instance;
        return this;
    }

    get instance() {
        return this._instance;
    }

    public getInstance = (): any => {
        return this._instance;
    }

    /**
     * UserService 에서는 '_id' 가 UserId 이지만 User 정보가 없는 class 에서는
     * 권한 체크나 부가적인 정보를 얻기 위해서는 User 가 필요함.
     * User 를 사용하기 위한 추가 변수 값.
     *
     * @param id {number} Service의 action을 수행하는 actor 의 User ID
     */
    public setUserId = (id: number) => {
        this.userId = parseIntSafe(id);
        return this;
    };

    /**
     * User ID 만으로는 정보가 부족해서 Actor의 정보를 DB에서 다시 읽어오는 경우가 빈번해서 호출하는 측에서 Actor 정보를 주입하도록 추가
     *
     * @param actor {IUser} Service의 action을 수행하는 actor
     */
    public setActor = (actor: IUser) => {
        this.actor = actor;
        return this;
    };

    public setTenantId = (tenantId: number) => {
        this.tenantId = parseIntSafe(tenantId);
        return this;
    };

    public setTransaction = (transaction: Transaction) => {
        this.transaction = transaction;
        return this;
    }

    public getTransaction = () => {
        return this.transaction;
    }

    public isOwnTransaction = (transaction) => {
        return transaction && !this.transaction;
    }

    public setTraceUuid = (traceId: string) => {
        this.traceUuid = traceId;
        return this;
    }

    public getTraceUuid = () => {
        return this.traceUuid ? this.traceUuid : null;
    }

    public setContext = (context: IContext) => {
        this.context = context;
        return this;
    }

    public getContext = (): any => {
        return this.context;
    }

    public force = (isForce = true) => {
        this.isForce = (isForce === true);
        return this;
    }

    protected assertMultipleTenantIds = (tenantIds: number[], error: Error = undefined) => {
        const actor = this.getActor();

        // 각기 다른 tenant_id를 가지는 경우에는 cross tenant 권한을 가져야 한다
        const uniqueTenantIds = [...new Set(tenantIds)];
        const tenantId = uniqueTenantIds[0];
        const isCrossTenantPermission = this.hasCrossTenantPermission();
        assertTrue((uniqueTenantIds.length === 1 && tenantId === actor.tenant_id) || isCrossTenantPermission, error);
    }

    protected hasCrossTenantPermission = (): boolean => {
        if (this.isForce) return true;

        const permissions = this.getActor()?.permissions || this.permissions;
        return permissions?.some(p => p.tenant);
    }

    protected hasCrossUserPermission = (): boolean => {
        if (this.isForce) return true;

        const permissions = this.getActor()?.permissions || this.permissions;
        return permissions?.some(p => p.user);
    }

    protected hasUnmaskPrivacyPermission = (): boolean => {
        if (this.isForce) return true;

        const permissions = this.getActor()?.permissions || this.permissions;
        return permissions?.some(p => (p.mask === 0 || p.mask === false));
    }

    protected hasSuperUserPermission = (actor: IUser = undefined): boolean => {
        if (this.isForce) return true;
        if (actor) this.actor = actor;

        const permissions = this.actor?.permissions || this.permissions;
        return permissions?.some(p => p.super);
    }

    protected hasChangeUserStatePermission = (): boolean => {
        if (this.isForce) return true;

        const permissions = this.getActor()?.permissions || this.permissions;
        return permissions?.some(p => p.state);
    }
}