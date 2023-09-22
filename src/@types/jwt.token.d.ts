export interface IJwtToken {
    uuid?: string,
    user_id?: number,
    client_id?: number,
    secret?: string,
    expires_in?: number,
    iat?: number,
    exp?: number,
    decrypted?: number
}
