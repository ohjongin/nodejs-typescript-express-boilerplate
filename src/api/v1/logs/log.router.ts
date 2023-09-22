import { Router } from 'express';
import LogController from './log.controller';

export const path = '/logs';
export const router = Router();

router.get('/', new LogController().get);
