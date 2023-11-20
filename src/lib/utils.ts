import dotenv from 'dotenv';
import { Decryptor, Encryptor } from 'strong-cryptor';
import short from 'short-uuid';
import logger from './logger';
import ApiError from '../common/api.error';
import ApiCodes from '../common/api.codes';
import ApiMessages from '../common/api.messages';
import { isValid, parse } from 'date-fns';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import appRoot from 'app-root-path';
import fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as Sentry from '@sentry/node';
import _ from 'lodash';
import os from 'os';
import { appPath } from '../app';
import dayjs from 'dayjs';
import { env } from '../env';
import process from 'process';
import * as flatted from 'flatted';

dotenv.config();

export const jsonMaskConfig = {
    cardFields: ['credit', 'debit'],
    emailFields: ['email'],
    passwordFields: ['password', 'source', 'target', 'client_secret', 'secret'],
    phoneFields: ['phone', 'mobile'],
    stringMaskOptions: {
        maskWith: "*",
        maskOnlyFirstOccurance: false,
    },
    stringFields: ['addr1', 'addr2', 'addr_state', 'addr_city', 'address'],
    uuidFields: ['uuid']
};

export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const getCaller = (depth = 2) => {
    const frame = new Error().stack.split("\n")[depth]; // change to 3 for grandparent func
    const line = frame.split(":").reverse()[1];
    const file = frame.split(':')[0].split('/').reverse()[0];
    const func = frame.split(" ")[5];

    return `${file}:${line} (${func})`
}

export const randomIntRange = (min: number, max: number) => crypto.randomInt(min, max);

export const randomString = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    const charsLength = chars.length;
    const randomBytes = crypto.randomBytes(length);
    const result = new Array(length);

    let cursor = 0;
    for (let i = 0; i < length; i++) {
        cursor += randomBytes[i];
        result[i] = chars[cursor % charsLength];
    }

    return result.join("");
};

export const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch (err) {
        return false;
    }
}

export const isValidDateString = (dateString) => {
    return isValid(parse(dateString, 'yyyyMMdd', new Date()));
}

export const encrypt = (value: string): string => {
    if (!value) return value;

    const crypto = new Encryptor({ key: env.auth.secret });
    return crypto.encrypt(value);
}

export const decrypt = (value: string): string => {
    if (!value) return value;

    const crypto = new Decryptor({ key: env.auth.secret });
    return crypto.decrypt(value);
}

export const uuid = (isShort = true): string => {
    const translator = short();
    return isShort ? translator.generate() : uuidv4();
}

export const propertiesToArray = obj => {
    const isObject = val =>
        val && typeof val === 'object' && !Array.isArray(val);

    const addDelimiter = (a, b) =>
        a ? `${a}.${b}` : b;

    const paths = (obj = {}, head = '') => {
        return Object.entries(obj)
            .reduce((product, [key, value]) => {
                const fullPath = addDelimiter(head, key)
                return isObject(value) ?
                    product.concat(paths(value, fullPath))
                    : product.concat(fullPath)
            }, []);
    }

    return paths(obj);
};

/**
 *
 * https://stackoverflow.com/questions/15690706/recursively-looping-through-an-object-to-build-a-property-list/53620876#53620876
 *
 * @param obj
 * @param stack
 */
export const iterate = (obj, stack) => {
    logger.debug(`obj: ${JSON.stringify(obj)}, stack: ${JSON.stringify(stack)}`);

    const item = {};
    for (const property in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, property)) continue;

        const value = obj[property];
        if (typeof value != "object") {
            logger.debug(property + "," + obj[property] + "," + stack);
            item[property] = value;
        } else {
            iterate(obj[property], stack?.length > 0 ? `${stack}.${property}` : `${property}`);
        }
    }
};

export const getParsedValue = (value) => {
    let result;
    try {
        // value가 JSON string인 경우
        result = JSON.parse(value);
    } catch (e) {
        result = value;
    }

    return result;
}

/**
 * Object에서 undefined 와 null 항목을 제거
 *
 * @param obj
 * @param filter
 */
export const prune = (obj, filter = [undefined, null]) => {
    if (!obj) return {};

    const result = { ...obj };
    Object.keys(result).forEach((key) => (filter?.includes(result[key])) && delete result[key]);
    return result;
};

/**
 * Object에서 empty object 항목을 제거
 *
 * @param obj
 */
export const clean = (obj) => {
    if (!obj) return {};

    const result = { ...obj };
    Object.keys(result).forEach((key) => (Object.keys(result[key]).length === 0) && delete result[key]);
    return result;
};

export const isEmptyObject = (obj) => {
    return !obj || Object.keys(obj).length < 1;
}

export const str2Date = (str: string, defaultValue = new Date()): Date => {
    let date;
    try {
        date = str ? new Date(str) : defaultValue;
    } catch (err) {
        date = defaultValue;
        logger.error(err);
    }

    return date;
}

export const isValidId = (id: number): boolean => {
    return (id !== undefined) && (id !== null) && !isNaN(id);
};

export const parseIntSafe = (data, value = undefined): number => {
    if (data === undefined) return value;

    let result = value;
    try {
        result = parseInt(data, 10);
        if (isNaN(result)) result = value;
    } catch (e) {
        logger.error(e);
    }

    return result;
};

export const parseFloatSafe = (data, value = undefined): number => {
    if (data === undefined) return value;

    let result = value;
    try {
        result = parseFloat(data);
        if (isNaN(result)) result = value;
    } catch (e) {
        logger.error(e);
    }

    return result;
};

export const parseBooleanSafe = (data, value = undefined): boolean => {
    if (data === undefined) return value;

    let result = value || true;

    if (typeof data === 'boolean') result = data;
    else if (typeof data === 'string') result = data.toLowerCase() === 'true';
    else if (typeof data === 'number') result = data === 0 ? false : true;
    else if (typeof data === 'undefined') result = value;

    return result;
}

export const numberWithCommas = x => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const isNumeric = (str) => {
    if (typeof str === 'number') return true;
    if (typeof str !== "string") return false // we only process strings!

    // @ts-ignore
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

export const getTempDirPath = () => {
    return path.join(appRoot.path, 'temp');
}

export const getTempDirSafe = () => {
    const dir = getTempDirPath();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export const initTempDir = () => {
    const dir = getTempDirPath();
    fsExtra.emptyDirSync(dir);
}

/**
 * 서비스를 다시 구동하는 경우에는 menu file이 업데이트 되었을 수 있으니 새로운 데이터로 갱신할 수 있도록 삭제한다
 */
export const initMenuFile = () => {
    try {
        const filePath = path.join(appRoot.path, 'menu.json');
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        logger.error(e);
    }
}

export const assertNull = (value: any, error: Error, callback = undefined) => {
    if (!value) return;
    if (callback instanceof Function) callback(error);
    if (error instanceof Error) throw error;
}

export const assertNotNull = (value: any, error: Error, callback = undefined) => {
    if (value) return;
    if (callback instanceof Function) callback(error);
    if (error instanceof Error) throw error;
}

export const assertTrue = (value: boolean, error: Error, callback = undefined) => {
    if (value === true || value) return;
    if (callback instanceof Function) callback(error);
    if (error instanceof Error) throw error;
}

export const handleSentry = (level, err, req = undefined, data = undefined) => {
    if (env.mode.test) return;

    if (err instanceof ApiError) {
        if (err.detail?.sentry === false) return;
    }

    try {
        Sentry.captureException(err, {
            level: level,
            extra: {
                headers: req?.headers,
                params: req?.params,
                query: req?.query,
                body: req?.body,
                detail: err?.detail,
                data,
            },
        });
    } catch (e) {
        logger.error(e);
    }
}

export const loadPackageInfo = async () => {
    let pkg, str;
    try {
        const packageInfoPath = path.join(appRoot.path, 'package.json');
        str = fs.readFileSync(packageInfoPath, { encoding: 'utf8', flag: 'r' });
        JSON.parse(str);
        pkg = str;
    } catch (e) {
        pkg = '{}';
        logger.error(getCaller(), os.hostname(), str, e);
    }

    return pkg;
}

export const getFileInfo = () => {
    const frame = new Error().stack.split("\n")[2]; // change to 3 for grandparent func
    const line = frame.split(":").reverse()[1];
    const file = frame.split(':')[0].split('/').reverse()[0];
    const func = frame.split(" ")[5];

    return `${file}:${line} (${func})`
}


type TraverseFunction<T> = (
    obj: T,
    prop: string,
    value: unknown,
    scope: string[]
) => void;

export const traverseObject = <T = Record<string, unknown>>(
    object: T,
    fn: TraverseFunction<T>
): void => traverseInternal(object, fn, []);

const traverseInternal = <T = Record<string, unknown>>(
    object: T,
    fn: TraverseFunction<T>,
    scope: string[] = []
): void => {
    Object.entries(object).forEach(([key, value]) => {
        fn.apply(this, [object, key, value, scope]);
        if (value !== null && typeof value === "object") {
            traverseInternal(value, fn, scope.concat(key));
        }
    });
};

export const deleteInvisibleElements = obj => {
    const keys = Object.keys(obj);
    keys.forEach(key => {
        if (obj[key].visible === false) {
            delete obj[key];
            return;
        }

        if (['roles', 'visible'].includes(key)) delete obj[key];
        else if (obj[key] && typeof obj[key] === 'object') {
            deleteInvisibleElements(obj[key]);
            if (!Object.keys(obj[key]).length) {
                delete obj[key];
            }
        }
    });
};

export const pruneEmptyDeep = obj => {
    return function prune(current) {
        _.forOwn(current, function (value, key) {
            if (_.isUndefined(value) || _.isNull(value) || _.isNaN(value) ||
                (_.isString(value) && _.isEmpty(value)) ||
                (_.isObject(value) && _.isEmpty(prune(value)))) {

                delete current[key];
            }
        });
        // remove any leftover undefined values from the delete
        // operation on an array
        if (_.isArray(current)) _.pull(current, undefined);

        return current;

    }(_.cloneDeep(obj));  // Do not modify the original object, create a clone instead
};

export const mergeObject = (toUpdate, refObj) => {
    const updateData = prune(toUpdate);
    const keys = Object.keys(updateData);
    for (const key of keys) {
        if (updateData[key] instanceof Date) continue;
        if (typeof updateData[key] === 'object') {
            updateData[key] = _.merge(refObj[key], updateData[key]);
        }
    }

    return updateData;
};

export const readMenuAsset = () => {
    let result = {
        version: 0,
        menus: [],
    };

    const str = fs.readFileSync(path.join(appPath, 'assets', 'menu.json'), { encoding: 'utf8', flag: 'r' });
    try {
        result = JSON.parse(str);
    } catch (e) {
        logger.error(e);
        handleSentry('error', e, undefined, str);
    }

    const keys = Object.keys(result);
    if (!keys.includes('version') || !keys.includes('menus')) {
        logger.error('readMenuAsset error: ' + JSON.stringify(result));
        result = {
            version: 0,
            menus: [],
        };
    }

    logger.log(`readMenuAsset version: ${result?.version}`);

    return result;
}

export const isSubset = (parentArray, subsetArray) => {
    return subsetArray.every((el) => {
        return parentArray.includes(el)
    })
}

export const isValidDate = (str) => {
    if (str instanceof Date) return true;

    return str && dayjs(str).isValid()
}

export const getQueryParamSplitRegex = (isSpaceDelimeter = true) => {
    return isSpaceDelimeter ? /[\s,+]/ : /[,+]/;
}

/**
 * value 가 null 인 경우 isNaN이 false를 반환하기 때문에 별도 utility가 필요함
 *
 * @param value
 */
export const isValidNumber = (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

export const isValidArray = (arr) => {
    return Array.isArray(arr) && arr.length > 0;
}

export const isValidVolume = (data) => {
    if (!data) return false;

    return isValidNumber(data.width) && isValidNumber(data.length) && isValidNumber(data.height);
}

export const isValidWeights = (data) => {
    if (!data) return false;

    return isValidNumber(data.gross) && isValidNumber(data.chargeable);
}

export const getAssetJson = (filename: string) => {
    let result;

    const str = fs.readFileSync(path.join(appPath, 'assets', filename), { encoding: 'utf8', flag: 'r' });
    try {
        result = JSON.parse(str);
    } catch (e) {
        logger.error(e);
        handleSentry('error', e, undefined, str);
    }

    return result;
}

export const extractObjectIds = (data) => {
    if (!data) return data;
    if (!isValidArray(data)) return data;

    const results = data.map(d => {
        if (isValidNumber(d)) return d;
        else if (typeof d === 'object' && isValidId(d._id)) return d._id;

        assertTrue(false, new ApiError(ApiCodes.BAD_REQUEST, ApiMessages.BAD_REQUEST), {
            message: `Invalid object array`,
            data,
        })
    });

    return results;
}

// https://stackoverflow.com/questions/70720839/is-there-a-way-to-check-japanese-kanji-in-react-js
// https://stackoverflow.com/questions/15033196/using-javascript-to-check-whether-a-string-contains-japanese-characters-includi
// /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/
// -------------_____________-------------_____________-------------_____________
// Punctuation   Hiragana     Katakana    Full-width       CJK      CJK Ext. A
//                                          Roman/      (Common &      (Rare)
//                                        Half-width    Uncommon)
//                                          Katakana
export const hasKanji = (str) => {
    if (!str) return false;

    const regex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/
    return str.match(regex) ? true : false;
};

export const flatten = (obj) => {
    return flatted.parse(flatted.stringify(obj));
}

export const jsonToString = (obj) => {
    return flatted.stringify(obj);
}

export const terminate = (value = 1) => {
    process.exit(value);
}