import {BaseService} from './common/base/base.service';

export default class AppService extends BaseService {
    constructor(context) {
        super(context);
    }

    describeHealthInfo = async () => {
        return {};
    }
}
