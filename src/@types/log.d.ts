
export interface ILog {
    _id?: number;
    resource?: string;
    resource_id?: number;
    method?: string;
    action?: string;
    state?: string;
    path?: string;
    url?: string;
    headers?: any;
    params?: any;
    query?: any;
    body?: any;
    code?: number;
    result?: any;
    token?: string;
    message?: string;
    receipt_no?: string;
    waybill_no?: string;
    ua?: string;
    ip_address?: string;
    trace_uuid?: string;
    actor_id?: number;
    tenant_id?: number;

    deleted_at?: Date;
    updated_at?: Date;
    created_at?: Date;
}
