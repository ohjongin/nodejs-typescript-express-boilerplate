import logger from './logger';
import path from 'path';
import {appPath} from '../app';
import {Sequelize} from 'sequelize';
import assert from 'assert-fine';
import assertCore from 'assert';

assert.use(assertCore);
assert.beforeThrow(() => {  //  This call is optional.
    return false;              //  The breakpoint place.
});

export default class Table {
    protected sequelize: any;
    protected filePath: string;

    constructor(sequelize: Sequelize, assetFile, protected model) {
        this.filePath = path.join(appPath, 'assets', assetFile);
        this.sequelize = sequelize;
    }

    public inject = async (truncate = true) => {
        logger.debug(`inject() model:${this.model.getTableName()} file:${this.filePath}`)

        const transaction = await this.sequelize.transaction();
        try {
            await transaction.commit();
        } catch (e) {
            await transaction.rollback();
            logger.error(e);
        }
    }
}