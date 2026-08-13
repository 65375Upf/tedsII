import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { auth } from '../middlewares/auth.js';
import { permitir } from '../middlewares/permitir.js';
import * as pontoController from '../controllers/pontoController.js';

export const pontoRoutes = Router();
pontoRoutes.use(auth);
pontoRoutes.get('/resumo-horas', asyncHandler(pontoController.resumoProprio));

export const pontoAdminRoutes = Router();
pontoAdminRoutes.use(auth);
pontoAdminRoutes.get(
  '/:id/ponto/resumo-horas',
  permitir('ADMIN'),
  asyncHandler(pontoController.resumoPorId)
);

// Define as rotas dos dois endpoints de resumo de horas, com autenticação
// (auth) e controle de acesso por perfil (permitir('ADMIN') na rota
// administrativa). Ainda não integrado ao app.js — integração feita junto
// com as demais atividades do grupo.