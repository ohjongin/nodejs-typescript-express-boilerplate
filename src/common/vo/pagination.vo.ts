export class PaginationVo {
    constructor(public page: number, public size: number) {
        this.page = page || 1;
        this.size = size || 20;

        // FIXME: frontend에서 자동 완성으로 사용하는 곳이 있어서 나중에 적용
        /*
        const maxPageSize = env.policy.max.page.size;
        if (size > maxPageSize) {
            const message = i18next.t(ApiMessages.OUT_OF_RANGE, {
                range: `1 ~ ${maxPageSize}`,
            });

            throw new ApiError(ApiCodes.BAD_REQUEST, message, {
                message: `size should be less than ${maxPageSize}`,
            })
        }*/
    }
}
