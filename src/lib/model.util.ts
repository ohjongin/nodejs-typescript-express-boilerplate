import { getParsedValue } from './utils';
import logger from './logger';
import { Model } from 'sequelize';

export const getPlainObject = (obj) => {
    let result = {...obj};
    try {
        // Sequelize Model을 plain 처리
        if (obj instanceof Model) result = obj.get({ plain: true });
    } catch (e) {
        logger.error(e);
    }

    return result;
}

export const removeSensitiveValues = (obj, depth = 1) => {
    if (depth > 10) return obj;

    const result = getPlainObject(obj);
    for (const property in result) {
        if (!Object.prototype.hasOwnProperty.call(result, property)) continue;

        const value = typeof result[property] === 'string' ? getParsedValue(result[property]) : result[property];
        if (typeof value === "object") {
            result[property] = removeSensitiveValues(value, depth + 1);
        } else if (typeof value === 'string') {
            if (['source', 'target'].includes(property?.toLowerCase()) || property?.toLowerCase().includes('password')) {
                result[property] = undefined;
            }
        }
    }
    return result;
};

export const securedStringify = (obj) => {
    let target;

    // Sequelize Model을 plain 처리
    if (obj instanceof Model) target = {...obj.get({ plain: true })};
    else target = {...obj};

    return JSON.stringify(removeSensitiveValues(target));
}
