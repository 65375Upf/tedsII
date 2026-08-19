import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import * as biometriaController from '../controllers/biometriaController.js';

const router = Router();

router.post('/cadastrar', asyncHandler(biometriaController.cadastrarBiometria));
router.post('/capturar', asyncHandler(biometriaController.capturarBiometria));
router.put('/alterar', asyncHandler(biometriaController.alterarBiometria));
router.get('/status', asyncHandler(biometriaController.listarLeitores));

export default router;
