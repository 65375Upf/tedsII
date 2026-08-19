import db from './src/db.js';
import * as biometriaModel from './src/models/biometriaModel.js';

try {
  console.log('--- INICIANDO TESTE DE ALTERAÇÃO DE BIOMETRIA ---');

  // 1. Busca a biometria atual do usuário 1
  const original = biometriaModel.buscarBiometria(1);
  if (!original) {
    console.error('Usuário 1 não encontrado ou sem biometria inicial.');
    process.exit(1);
  }
  
  const originalBuffer = original.biometria;
  console.log('Biometria Original (Tamanho):', originalBuffer.length, 'bytes');
  console.log('Biometria Original (Primeiros 15 bytes):', originalBuffer.subarray(0, 15));

  // 2. Gera um novo valor fictício de biometria para teste
  // Usamos um valor ligeiramente diferente do atual
  const mockBiometria = Buffer.from(JSON.stringify({
    fmd: {
      callbackRet: 0,
      readableRet: 'FMD was created.',
      mocked: true,
      timestamp: Date.now()
    }
  }));

  console.log('\nSalvando nova biometria fictícia...');
  
  // 3. Executa a alteração no banco
  const result = biometriaModel.salvarBiometria(1, mockBiometria);
  console.log('Resultado do UPDATE (changes):', result.changes);

  // 4. Busca a biometria atualizada para comparar
  const atualizada = biometriaModel.buscarBiometria(1);
  const atualizadaBuffer = atualizada.biometria;
  console.log('\nBiometria Atualizada (Tamanho):', atualizadaBuffer.length, 'bytes');
  console.log('Biometria Atualizada (Primeiros 15 bytes):', atualizadaBuffer.subarray(0, 15));

  // 5. Verifica se mudou
  const saoIguais = originalBuffer.equals(atualizadaBuffer);
  console.log('\n--- VERIFICAÇÃO ---');
  if (!saoIguais) {
    console.log('✅ SUCESSO: Os dados no banco de dados foram ALTERADOS e diferem da biometria anterior!');
  } else {
    console.log('❌ FALHA: Os dados permanecem idênticos!');
  }

  // 6. Restaura a biometria original para não perder o cadastro real do usuário
  console.log('\nRestaurando a biometria original...');
  biometriaModel.salvarBiometria(1, originalBuffer);
  console.log('✅ Biometria original restaurada com sucesso.');

} catch (error) {
  console.error('Ocorreu um erro no teste:', error);
}
