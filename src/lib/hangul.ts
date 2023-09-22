// @ts-ignore
import * as hangul from 'hangul-js';

// const converted = Buffer.from(file.originalname, 'latin1').toString('utf8');
// 한글 유니코드 영역 ( https://cosmic.mearie.org/f/ngsdoc/appendix_coderef.htm )
// 호환용 자모: U+3131 ~ U+314E ~ U+314F ~ U+318E (ㄱ ~ ㅎ ~ ㅏ ~ ㆎ)
// 초성: U+1100 ~ U+A97C
// 종성: U+11A8 ~ U+11F9
// U+AC00: 가
// u+D7A3: 힣
// 파일명으로 사용 불가능한 문자를 포함하는지 확인하는 Regular Expression
const InvalidFileCharRegex = /[^\u1100-\u11f9|\u3131-\u318E|\uAC00-\uD7A3|ㄱ-ㅎ|ㅏ-ㅣ|가-힣A-Za-z0-9\-\(\)._ ]/g;
// 파일명으로 사용 가능한 문자를 포함하는지 확인하는 Regular Expression
const ValidFileCharRegex = /[\u1100-\u11f9|\u3131-\u318E|\uAC00-\uD7A3|ㄱ-ㅎ|ㅏ-ㅣ|가-힣A-Za-z0-9\-\(\)._ ]/g;
// 맥 조합형 한글 자소 분리 상태인지 확인하는 Regular Expression
const NfdCharRegex = /[\u1100-\u11f9|\u3131-\u318E]/;
// const hangul = /[\u1100-\u11f9|\u3131-\u318E|\uAC00-\uD7A3|ㄱ-ㅎ|ㅏ-ㅣ|가-힣A-Za-z0-9\-._ ]/g;
// const specialChar = /[\x00-\x1F]/

export const hasInvalidCharForFile = (str) => {
    return InvalidFileCharRegex.test(str);
}

export const isValidFilename = (str) => {
    const match = str.match(ValidFileCharRegex);
    return match && match.length === str.length;
}

export const getValidFilename = (str) => {
    let filename = str;

    if (hasInvalidCharForFile(str)) {
        filename = Buffer.from(str, 'latin1').toString('utf8');
    }

    if (hasNfdChar(filename)) {
        filename = filename.normalize('NFC');
    }

    return filename;
}

/**
 * 맥 조합형 한글 자음/모음 분리 상태인지 확인
 * @param str
 * @returns {boolean} true: 맥 조합형 한글 자음/모음 분리 상태
 */
export const hasNfdChar = (str) => {
    return NfdCharRegex.test(str);
}