import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { auth, authOpcional } from '../middlewares/auth.js';
import * as authController from '../controllers/authController.js';

const router = Router();

// authOpcional: decodifica o token se ele vier, mas não bloqueia a requisição
// sem token (necessário para o bootstrap do primeiro usuário/ADMIN do sistema).
router.post('/registrar', authOpcional, asyncHandler(authController.registrar));
router.post('/login', asyncHandler(authController.login));
router.get('/me', auth, authController.me);

export default router;
