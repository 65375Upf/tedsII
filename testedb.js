import db from './src/db.js'; // ajuste o caminho se necessário

try {
  // Busca todos os usuários cadastrados
  const usuarios = db.prepare('SELECT id, nome, biometria FROM usuarios').all();
  
  console.log('--- USUÁRIOS NO BANCO ---');
  console.table(usuarios);

} catch (error) {
  console.error('Erro ao consultar o banco:', error.message);
}