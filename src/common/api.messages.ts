const ApiMessages = Object.freeze({
    OK: 'api.common.ok',
    BAD_REQUEST: 'api.common.bad_request',
    UNAUTHORIZED: 'api.common.unauthorized',
    PASSWORD_MISMATCHED: 'api.common.password_mismatched',
    CREDENTIAL_INVALID: 'api.common.credential_invalid',
    TOKEN_EXPIRED: 'api.common.token_expired',
    TOKEN_INVALID: 'api.common.token_invalid',
    FORBIDDEN: 'api.common.forbidden',
    NOT_FOUND: 'api.common.not_found',
    CONFLICT: 'api.common.conflict',
    CANNOT_DELETE: 'api.common.error',
    OUT_OF_RANGE: 'api.common.out_of_range',
    TOO_BIG: 'api.common.too_big',
    INTERNAL_SERVER_ERROR: 'api.common.error',
    ERROR: 'api.common.error',

    ORDER_STATE_CHANGE_FAILED: 'api.order.state_change_failed',
    ORDER_STATE_CHANGE_FAILED_RETURN: 'api.order.state_change_failed_return',
    ORDER_STATE_CHANGE_FAILED_DETAIL: 'api.order.state_change_failed_detail',
    ORDER_STATE_CHANGE_FAILED_VOLUME: 'api.order.state_change_failed_volume',
    ORDER_STATE_CHANGE_FAILED_SELLER: 'api.order.state_change_failed_seller',
    ORDER_STATE_CHANGE_FAILED_MASTER: 'api.order.state_change_failed_master',
    ORDER_STATE_CHANGE_FAILED_UNKNOWN: 'api.order.state_change_failed_unknown',
    ORDER_MODIFICATION_FORBIDDEN: 'api.order.modification_forbidden',
    ORDER_NOT_FOUND: 'api.order.not_found',
    ORDER_INVALID_ID_OR_CODE: 'api.order.invalid_id_or_code',
    ORDER_INVALID_STATE: 'api.order.invalid_state',
    ORDER_MERGE_NOT_FOUND: 'api.order.merge_not_found',
    ORDER_CURRENCY_MISMATCH: 'api.order.currency_mismatch',
    ORDER_ZIPCODE_EMPTY: 'api.order.zipcode_empty',
    ORDER_ZIPCODE_REQUIRED: 'api.order.zipcode_required',

    PARCEL_EMPTY_IN_ORDER: 'api.parcel.empty_in_order',
    PARCEL_INVALID_IN_ORDER: 'api.parcel.invalid_in_order',

    ACCOUNT_LOCKED: 'api.user.locked',
    ACCOUNT_WAITING: 'api.user.waiting',

    USER_ALREADY_EXIST: 'api.user.already_exist',

    SIGNUP_CONFLICT: 'api.signup.conflict',

    CODE_USED: 'api.code.used',

    CBT_NATION_CODE_MISMATCH: 'api.cbt.nation_code_mismatch',

    EMAIL_TITLE_SIGNUP_VERIFICATION: 'email.title.signup.verification',
    EMAIL_TITLE_SIGNUP_NOTIFICATION: 'email.title.signup.notification',
    EMAIL_TITLE_INVITE: 'email.title.invite',
    EMAIL_TITLE_PASSWORD_RESET_REQUEST: 'email.title.password_reset.request',
    EMAIL_TITLE_PASSWORD_RESET_NOTIFICATION: 'email.title.password_reset.notification',
});

export default ApiMessages;
