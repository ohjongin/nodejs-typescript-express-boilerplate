export interface IPermission {
    _id?: number;
    type?: string;
    resource?: string;
    role_name?: string;
    create?: boolean;   // 생성 권한
    list?: boolean;     // 목록 읽기
    read?: boolean;     // 개별 읽기
    change?: boolean;   // 변경 권한
    delete?: boolean;   // 삭제 권한
    mask?: boolean | number;     // 개인정보 masking 해제 권한
    tenant?: boolean;   // 다른 Tenant 접근 권한
    user?: boolean;     // 다른 User 접근 권한
    state?: boolean;    // User 상태 변경 권한
    super?: boolean;    // 시스템 관리자 권한 (예외적으로 사용)

    role_id?: number;

    deleted_at?: Date;
    updated_at?: Date;
    created_at?: Date;
}
