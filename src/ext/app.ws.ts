import { env } from '../env';
import logger from '../lib/logger';
import { WebSocketServer } from 'ws';
import * as jwt from '../lib/jwt';
import UserService from '../api/v1/users/user.service';
import crypto from 'crypto';

const clients = new Map();

export const listenWebSocket = (server) => {
    if (!env.app.websocket) return undefined;

    /**
     * Core server 인증 token 값을 parameter로 접속해야 함.
     *
     * ws://localhost:3001/?token=eyJhb**********...(중략)....**************kmpl79Tik
     */
    const wss = new WebSocketServer({
        verifyClient: async (info, done) => {
            logger.debug(`WebSocketServer verifyClient: ${info.req.url}`);
            const qs = info.req.url.split('/');
            if (info.req.url === '/' || qs?.length < 1) {
                done(info.req);
                return;
            }

            const params = new URLSearchParams(qs[1]);
            const value = params.get('token');
            if (value?.length < 1) {
                done(info.req);
                return;
            }

            const token = jwt.decode(value);
            logger.debug(JSON.stringify(token));

            if (token && token?.user_id) {
                // info.req.user is either null or the user and you can destroy the connection if its null
                info.req.user = await UserService.get(token.user_id);
            }

            done(info.req);
        },
        server
    });

    wss.on('connection', (ws, req) => {
        const clientIp = req.clientIp || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        // 인증 실패시 종료
        if (!req.user) {
            logger.error(`Unauthorized. clientIp:${clientIp}`);
            ws.send('Error: connect ECONNREFUSED')
            ws.close();
            return;
        }

        const id = getUniqueID();
        const color = Math.floor(Math.random() * 360);
        const metadata = { id, color };

        clients.set(ws, metadata);
        ws.send(id);

        ws.on('message', (data) => {
            const str = Buffer.from(data).toString();
            const metadata = clients.get(ws);

            const message = {
                sender: metadata.id,
                color: metadata.color,
                message: str,
            };

            [...clients.keys()].forEach((client) => {
                client.send(JSON.stringify(message));
            });
        });

        ws.on("close", () => {
            clients.delete(ws);
        });
    });

    const getUniqueID = () => {
        function s4() {
            return Math.floor(crypto.randomInt(1, 0x10000) + 0x1000).toString(16).substring(0, 4);
        }
        return s4() + s4() + '-' + s4();
    };

    return wss;
}

export const getWebSocket = (id) => {
    return [...clients.keys()].find((client) => client.id === id);
}