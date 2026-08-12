import jwt from 'jsonwebtoken';
import ApiError from '../errors/apiError.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-desenvolvimento';

export function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Token ausente ou inválido.'));
  }

  const token = header.slice('Bearer '.length);

  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Token ausente ou inválido.'));
  }
}

// Igual ao `auth`, mas nunca bloqueia a requisição por falta de token.
// Usado em POST /auth/registrar: sem token, req.usuario fica null (caso do
// bootstrap do primeiro usuário); com token válido, popula req.usuario normalmente,
// para o controller decidir se quem está chamando pode ou não cadastrar alguém.
export function authOpcional(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    req.usuario = null;
    return next();
  }

  const token = header.slice('Bearer '.length);

  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    req.usuario = null;
  }
  next();
}
