const ApiHeaders = Object.freeze({
    ACTION_BY_FORCE             : 'x-action-by-force',
    DEBUG_RESPONSE_ERROR_LOG    : 'x-debug-error-log',              // 'off' 이면 에러가 발생해도 에러 로그 출력 안함
    DEBUG_RESPONSE_ERROR_DETAIL  : 'x-debug-error-detail',            // 'verbose' 이면 에러 정보 상세하게 반환
    DEBUG_RESPONSE_CALLER_INFO  : 'x-debug-caller',                 // API 호출 코드 정보
});

export default ApiHeaders;
