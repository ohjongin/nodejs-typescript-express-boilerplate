import { Router } from 'express';
import * as v1 from './api/v1/v1.router';
import AppController from './app.controller';

export const router = Router();
export const path = '';

/**
 * API version에 독립적인 Route path
 */
router.get('/health', new AppController().health);

/*
 hostname으로 접속시 SSO hostname으로 redirect
 */
router.get('/', new AppController().redirect);

/* API v1 */
router.use(v1.path, v1.router);