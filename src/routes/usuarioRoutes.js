import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { auth } from '../middlewares/auth.js';
import { permitir } from '../middlewares/permitir.js';
import * as usuarioController from '../controllers/usuarioController.js';

const router = Router();

router.use(auth); // toda rota abaixo desta linha exige um token válido

router.get('/', permitir('ADMIN'), usuarioController.listar);
router.get('/:id', usuarioController.buscarPorId); // regra fina (ADMIN ou próprio id) fica no controller
router.put('/:id', permitir('ADMIN'), asyncHandler(usuarioController.substituir));
router.patch('/:id', asyncHandler(usuarioController.atualizarParcial)); // idem: ADMIN ou próprio id, validado no controller
router.delete('/:id', permitir('ADMIN'), usuarioController.remover);

router.get('/:id/remuneracao', usuarioController.buscarRemuneracao);
router.patch('/:id/remuneracao', permitir('ADMIN'), asyncHandler(usuarioController.atualizarRemuneracao));
router.get('/:id/folha/pre-calculo', permitir('ADMIN'), usuarioController.preCalculaSalario);

export default router;
