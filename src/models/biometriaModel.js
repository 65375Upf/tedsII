import db from '../db.js';

export function salvarBiometria(usuarioId, biometria) {
    const stmt = db.prepare(`update usuarios set biometria = ? where id = ?`);
    return stmt.run(biometria, usuarioId);
}

export function buscarBiometria(usuarioId) {
    const stmt = db.prepare(`select biometria from usuarios where id = ?`);
    return stmt.get(usuarioId);
}

export function buscarUsuariosComBiometria() {
    const stmt = db.prepare(`select id, nome, biometria from usuarios where biometria is not null`);
    return stmt.all();
}
