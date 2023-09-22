import { IJwtToken } from './jwt.token';
import { TokenType } from '../common/token.type';

export interface ITokenPayload {
    ok: boolean,
    expired: boolean,
    verified: boolean,
    registered: boolean,
    decoded: IJwtToken,
    type: TokenType,
    token: any,
    error: Error
}
