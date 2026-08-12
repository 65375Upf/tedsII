import ApiError from '../errors/apiError.js';

// Uso: router.get('/usuarios', auth, permitir('ADMIN'), usuarioController.listar)
// Precisa rodar depois do middleware `auth`, que já deve popular req.usuario = { sub, role, ... }.
export function permitir(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'Você não tem permissão para acessar este recurso.'));
    }
    next();
  };
}
