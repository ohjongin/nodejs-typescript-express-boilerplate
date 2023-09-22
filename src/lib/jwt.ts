import jsonwebtoken from 'jsonwebtoken';
import { Decryptor, Encryptor } from 'strong-cryptor';
import env from '../env';
import logger from './logger';
import { ITokenPayload } from '../@types/token';
import { Builder } from 'builder-pattern';
import { IJwtToken } from '../@types/jwt.token';
import { TokenType } from '../common/token.type';
import ms from 'ms';

export const createAccessToken = (userId, clientId): string => {
    const crypto = new Encryptor({ key: env.auth.secret });
    const encrypted = crypto.encrypt('' + userId);
    const payload = {
        user_id: userId,
        client_id: clientId,
        type: TokenType.ACCESS,
        secret: encrypted,
    };
    const expiresIn = env.policy.token.access.expire;

    logger.debug(`createAccessToken() userId: ${JSON.stringify(userId)}, clientId: ${JSON.stringify(clientId)}`);

    return jsonwebtoken.sign(payload, env.auth.jwt.secret, {
        algorithm: 'HS256',
        expiresIn: ms(expiresIn),
        issuer: env.app.name,
    });
};

export const createRefreshToken = () => {
    logger.debug(`createRefreshToken()`)

    const payload = {
        type: TokenType.REFRESH,
    };

    return jsonwebtoken.sign(payload, env.auth.jwt.secret, {
        algorithm: 'HS256',
        expiresIn: ms(env.policy.token.refresh.expire),
        issuer: env.app.name,
    });
}

/**
 * @param token jwt token
 */
export const decode = (token: string): IJwtToken => {
    if (!token) {
        return {
            expires_in: 0,
            iat: 0,
            exp: 0,
        };
    }

    const decoded = jsonwebtoken.decode(token);
    if (decoded?.secret) {
        const crypto = new Decryptor({ key: env.auth.secret });
        decoded.decrypted = parseInt(crypto.decrypt(decoded?.secret));
    }

    return decoded;
};

/**
 * @param token jwt token
 * @throws {ApiError} token 값이 jwt 형식이어야 함
 */
export const verify = (token: string): IJwtToken => {
    if (!token) {
        return {};
    }

    const decoded = jsonwebtoken.verify(token, env.auth.jwt.secret);
    if (decoded?.secret) {
        const crypto = new Decryptor({ key: env.auth.secret });
        decoded.decrypted = parseInt(crypto.decrypt(decoded?.secret));
    }
    return decoded;
};

/**
 * @param token jwt token
 * @throws {ApiError} token 값이 jwt 형식이어야 함
 */
export const parseToken = (token: string): ITokenPayload => {
    let decoded;
    let result;
    let expired;
    let verified;
    let error;
    let type: TokenType;

    try {
        decoded = exports.decode(token);

        if (decoded.user_id) {
            type = TokenType.ACCESS;
            verified = decoded.user_id === decoded.decrypted;
        } else {
            type = TokenType.REFRESH;
            verified = !decoded.secret && !decoded.user_id;
        }

        const expires_at = decoded.exp * 1000;
        expired = expires_at - new Date().getTime() < env.policy.token.issue.margin;
        result = verified && !expired;
    } catch (err) {
        logger.error(JSON.stringify(err));
        logger.error(err);

        error = err;
    }

    return Builder<ITokenPayload>()
        .type(type)
        .ok(result)
        .expired(expired)
        .verified(verified)
        .decoded(decoded)
        .error(error)
        .build();
};


