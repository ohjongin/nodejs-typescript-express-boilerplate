import {IPermission} from "./permission";

export interface IUser {
    _id?: number;               // 사용자 고유 ID 값. (수정불가)
    username?: string;          // 사용자 고유 계정. (수정불가)
    password?: string;          // 비밀번호 (전용 API를 통해서만 수정 가능)

    salt?: string;              // 시스템 내부 사용 값 (수정불가)
    uuid?: string;              // 시스템 내부 사용 값 (수정불가)
    user_name?: string;         // 시스템 내부 사용 값 (수정불가)
    failed?: number;            // 사용자 로그인 실패 횟수 (수정불가)
    locked?: boolean;           // 사용자 계정 잠김 여부 (수정불가, 전용 API로 해제 가능)
    mask?: boolean;             // 개인정보 조회시 마스킹 여부
    state?: string;             // 사용자 계정 상태 (수정불가)

    trace_uuid?: string;
    tenant_id?: number;
    client_id?: number;
    actor_id?: number;

    permissions?: IPermission[];

    login_at?: Date;
    approved_at?: Date;
    deleted_at?: Date;
    updated_at?: Date;
    created_at?: Date;
}
