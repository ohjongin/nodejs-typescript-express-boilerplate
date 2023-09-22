import { Model, Op, Sequelize, Transaction } from 'sequelize';
import { assertNotNull, assertTrue, isValidId, parseIntSafe, prune } from '../../lib/utils';
import ApiError from '../api.error';
import ApiCodes from '../api.codes';
import ApiMessages from '../api.messages';
import logger from '../../lib/logger';
import { PaginationVo } from '../vo/pagination.vo';
import { IContext } from '../../@types/context';
import { BaseController } from './base.controller';
import { BaseService } from './base.service';
import tid from 'cls-rtracer';
import {IUser} from "../../@types/user";
import { modelIncludes, modelTableObject } from '../../models/model.common';

export default class BaseRepository<M extends Model> {
    protected request: any = {};
    protected environment: any = {};

    protected context: IContext;
    protected _id: number;
    protected _instance?: any;

    protected tenantId: number;
    protected userId: number;
    protected actor: any;
    protected sortOrder = undefined;
    protected includes = undefined;
    protected traceUuid: string;
    protected transaction: Transaction = undefined;
    protected default: any;

    constructor(context: BaseController | BaseService | IContext = undefined, protected model) {
        // noinspection DuplicatedCode
        if (context instanceof BaseController || context instanceof BaseService) {
            this.context = context.getContext();
            this.request = context.req;
            this.environment = context.env;

            this.actor = context.getActor();
            this.transaction = context.getTransaction();
            this.traceUuid = this.req.tid || tid.id();
        } else {
            this.context = context;
            this.traceUuid = this.req.tid || tid.id();
        }

        this.default = {
            deleted_at: {
                [Op.eq]: null,
            },
        };
    }

    get env() {
        return this.environment;
    }

    get req() {
        return this.request;
    }

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

    public setId = (id: number) => {
        this._id = parseIntSafe(id);
        return this;
    };

    /**
     * UserService 에서는 '_id' 가 UserId 이지만 User 정보가 없는 class 에서는
     * 권한 체크나 부가적인 정보를 얻기 위해서는 User 가 필요함.
     * User 를 사용하기 위한 추가 변수 값.
     *
     * @param id {number}
     */
    public setUserId = (id: number) => {
        this.userId = parseIntSafe(id);
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

    /**
     * User ID 만으로는 정보가 부족해서 Actor의 정보를 DB에서 다시 읽어오는 경우가 빈번해서 호출하는 측에서 Actor 정보를 주입하도록 추가
     *
     * @param actor {IUser} Service의 action을 수행하는 actor
     */
    public setActor = (actor: IUser) => {
        this.actor = actor;
        return this;
    };

    protected getActor = (): IUser => {
        return this.actor;
    }

    public setActorId = (id: number) => {
        this._id = parseIntSafe(id);
        return this;
    };

    protected getActorId = (): number => {
        return this.actor?._id;
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

    public getSortOrder = () => {
        return this.sortOrder;
    }

    public setSortOrder = (sortOrder: any) => {
        this.sortOrder = sortOrder;
        return this;
    }

    public setIncludes = (includes: any) => {
        this.includes = includes;
        return this;
    }

    public setDefaultCondition = (condition: any) => {
        this.default = condition;
        return this;
    }

    protected parseSortParam = (sort: string) => {
        if (!sort) {
            return undefined;
        }

        let sortOrder = undefined;
        const split = sort.split(/[\s+]/);
        if (split?.length === 2 && ['asc', 'desc'].includes(split[1]?.toLowerCase())) {
            const column = this.model.tableAttributes[split[0]?.toLowerCase()];
            assertNotNull(column, new ApiError(ApiCodes.BAD_REQUEST, ApiMessages.BAD_REQUEST, {
                message: `The field(${split[0]}) specified as a sort option is invalid`,
                sort
            }))
            sortOrder = [[split]];
        } else {
            throw new ApiError(ApiCodes.BAD_REQUEST, ApiMessages.BAD_REQUEST, {
                message: `The value(${sort}) specified as a sort option is invalid`,
                sort
            })
        }

        return sortOrder;
    }

    public getModelInclude = () => {
        assertNotNull(this.model, new ApiError(ApiCodes.INTERNAL_SERVER_ERROR, ApiMessages.INTERNAL_SERVER_ERROR, {
            message: `model(${this.model}) does not defined...`,
            model: this.model
        }));

        if (this.includes && this.includes?.length > 0) return this.includes;

        const includes = modelIncludes.find(e => e.table === this.model.tableName);
        if (!includes) {
            logger.info(`model(${this.model?.tableName}) includes does not defined...`);
        }

        return includes?.includes || [];
    }

    public get = async (id: number = undefined): Promise<M> => {
        const resourceId = id || this._id;
        assertTrue(isValidId(resourceId), new ApiError(ApiCodes.BAD_REQUEST, ApiMessages.BAD_REQUEST, {
            message: `Invalid resource id(${resourceId}) at ${this.model?.tableName}`
        }));

        const where = {...{ _id: parseIntSafe(resourceId, -1) }, ...this.default };

        const item = await this.model.findOne({
            include: this.getModelInclude(),
            distinct:true,
            where,
            transaction: this.transaction
        });

        return item;
    };

    public findByCode = async (code, columns = undefined): Promise<M> => {
        if (!columns) {
            return this.get(code);
        }

        if (isValidId(code)) {
            const item = this.get(code);
            if (item) return item;
        }

        const conditions: any[] = [];

        if (Array.isArray(columns) && columns.length > 0) {
            for (const column of columns) {
                conditions.push(Sequelize.where(Sequelize.col(`${column}`), code));
            }
        } else if (typeof columns === 'string') {
            conditions.push(Sequelize.where(Sequelize.col(`${columns}`), code));
        }

        return this.findOne({
            [Op.or]: conditions,
        });
    }

    /**
        지정한 조건으로 Item을 찾는다
     */
    public findOne = async (attr: any): Promise<M> => {
        if (!attr) {
            logger.error(`Invalid parameter(${attr})`);
            return Promise.resolve(null);
        }

        const condition = prune(attr);
        const where = { ...condition, ...this.default };

        return this.model.findOne({
            include: this.getModelInclude(),
            distinct:true,
            where,
            transaction: this.transaction
        });
    };

    public getAll = async (attr: any) => {
        return this.model.findAll(attr);
    }

    public findAll = async (attr: any, page: PaginationVo = undefined): Promise<{ rows; count }> => {
        const sortOrder = this.parseSortParam(attr?.sort) || [['_id', 'DESC']];
        delete attr?.sort;

        const include = this.getModelInclude() || [];
        if (attr?.includes) {
            const tables = attr.includes.split(',');
            delete attr.includes;
            for (const table of tables) {
                const model = modelTableObject.find(e => e.table === table).model;
                if (model) {
                    include.push({
                        model: model,
                        required: false,
                        where: {
                            deleted_at: {
                                [Op.eq]: null,
                            },
                        },
                    })
                }
            }
        }

        const condition = prune(attr);
        const where = { ...condition, ...this.default };

        const options = {
            include,
            distinct:true,
            where,
            order: sortOrder,
            transaction: this.transaction
        }

        if (page instanceof PaginationVo) {
            options['offset'] = page.size * (page.page - 1);
            options['limit'] = page.size;
        }

        return this.model.findAndCountAll(options);
    };
}
