import { UareU, CONSTANTS } from 'uareu-node';
import * as biometriaModel from '../models/biometriaModel.js';
import ApiError from '../errors/apiError.js';
import fs from 'fs';
import path from 'path';
import ref from 'ref-napi';

const uareu = UareU.getInstance();

function salvarImagemBmp(dados, usuarioId) {
  try {
    const width = dados.captureResult.info.width;
    const height = dados.captureResult.info.height;
    const imageSize = dados.imageSize;

    // Reinterpreta os dados da imagem usando o ref-napi
    const rawBuffer = ref.reinterpret(dados.imageData, imageSize);

    // Assegura que o diretório "capturas" existe
    const dirCapturas = path.join(process.cwd(), 'capturas');
    if (!fs.existsSync(dirCapturas)) {
      fs.mkdirSync(dirCapturas, { recursive: true });
    }

    // O formato ANSI 381 tem um cabeçalho de 52 bytes. Os pixels vêm depois.
    const headerOffset = imageSize - (width * height);
    if (headerOffset < 0) {
      console.error('Tamanho de imagem inválido para extração de pixels.');
      return;
    }

    const rawPixels = rawBuffer.subarray(headerOffset);

    // Criação do arquivo BMP (8-bit grayscale)
    // 1. BMP File Header (14 bytes)
    const fileHeader = Buffer.alloc(14);
    fileHeader.write('BM', 0); // Signature

    // 2. DIB Header (BITMAPINFOHEADER - 40 bytes)
    const dibHeader = Buffer.alloc(40);
    dibHeader.writeUInt32LE(40, 0); // Header size
    dibHeader.writeInt32LE(width, 4); // Width
    dibHeader.writeInt32LE(-height, 8); // Height (negative for top-down)
    dibHeader.writeUInt16LE(1, 12); // Color planes
    dibHeader.writeUInt16LE(8, 14); // Bits per pixel (8-bit)
    dibHeader.writeUInt32LE(0, 16); // Compression (BI_RGB = 0)

    // Alinhamento de linha para BMP (cada linha deve ser múltiplo de 4 bytes)
    const rowSize = Math.ceil(width / 4) * 4;
    const pixelDataSize = rowSize * height;

    fileHeader.writeUInt32LE(14 + 40 + 1024 + pixelDataSize, 2); // File size
    fileHeader.writeUInt32LE(14 + 40 + 1024, 10); // Offset to pixel data

    dibHeader.writeUInt32LE(pixelDataSize, 20); // Image size

    // 3. Color Palette (1024 bytes: 256 colors * 4 bytes each [B, G, R, Reserved])
    const palette = Buffer.alloc(1024);
    for (let i = 0; i < 256; i++) {
      const offset = i * 4;
      palette[offset] = i;     // Blue
      palette[offset + 1] = i; // Green
      palette[offset + 2] = i; // Red
      palette[offset + 3] = 0; // Reserved
    }

    // 4. Pixel data com preenchimento de 4 bytes por linha
    const pixelData = Buffer.alloc(pixelDataSize);
    for (let y = 0; y < height; y++) {
      const srcOffset = y * width;
      const destOffset = y * rowSize;
      rawPixels.copy(pixelData, destOffset, srcOffset, srcOffset + width);
    }

    const bmpBuffer = Buffer.concat([fileHeader, dibHeader, palette, pixelData]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `usuario_${usuarioId}_${timestamp}.bmp`;
    const filepath = path.join(dirCapturas, filename);

    fs.writeFileSync(filepath, bmpBuffer);
    console.log(`Imagem salva com sucesso em: ${filepath}`);
  } catch (err) {
    console.error('Erro ao salvar imagem BMP:', err);
  }
}
let reader = null;

async function obterLeitor() {
  if (reader) {
    return reader;
  }

  try {
    await uareu.loadLibs();
    await uareu.dpfpddInit();

    const { devicesList = [] } = await uareu.dpfpddQueryDevices();
    if (!devicesList.length) {
      throw new ApiError(503, 'READER_NOT_FOUND', 'Nenhum leitor biométrico foi encontrado.');
    }

    const leitorAberto = await uareu.dpfpddOpen(devicesList[0]);
    if (!leitorAberto) {
      throw new ApiError(503, 'READER_OPEN_FAILED', 'Não foi possível abrir o leitor biométrico.');
    }

    reader = leitorAberto;
    return reader;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, 'BIOMETRIA_INIT_ERROR', 'Erro ao inicializar o leitor biométrico.');
  }
}

export async function listarLeitores(req, res) {
  const leitor = await obterLeitor();

  res.json({
    ok: true,
    leitor: 'disponível',
    reader: leitor ? 'conectado' : 'desconectado',
  });
}

function normalizarBiometria(valor) {
  if (!valor) {
    return null;
  }

  if (typeof valor === 'string') {
    return valor.replace(/^data:.*;base64,/, '');
  }

  if (typeof valor === 'object') {
    if (typeof valor.base64 === 'string') return valor.base64.replace(/^data:.*;base64,/, '');
    if (typeof valor.data === 'string') return valor.data.replace(/^data:.*;base64,/, '');
    if (typeof valor.value === 'string') return valor.value.replace(/^data:.*;base64,/, '');
  }

  return null;
}

export async function cadastrarBiometria(req, res) {
  const { usuarioId } = req.body;

  if (!usuarioId) {
    throw new ApiError(400, 'VALIDATION_ERROR', "O campo 'usuarioId' é obrigatório.");
  }

  const usuario = biometriaModel.buscarBiometria(Number(usuarioId));
  if (!usuario) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado para salvar biometria.');
  }

  if (usuario.biometria !== null) {
    throw new ApiError(409, 'ALREADY_REGISTERED', 'Este usuário já possui uma biometria cadastrada.');
  }

  let valorBiometria;
  const biometriaRecebida = normalizarBiometria(
    req.body?.biometria ?? req.body?.template ?? req.body?.fmd ?? req.body?.fingerprint
  );

  if (biometriaRecebida) {
    valorBiometria = Buffer.from(biometriaRecebida, 'base64');
  } else {
    const leitor = await obterLeitor();

    // Cancela qualquer captura pendente anterior
    try {
      await uareu.dpfpddCancel(leitor);
    } catch (err) {
      // Ignora se não houver captura em andamento
    }

    const dados = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Cancela a captura se der timeout para liberar o leitor
        uareu.dpfpddCancel(leitor).catch(() => {});
        reject(new ApiError(408, 'CAPTURE_TIMEOUT', 'Tempo limite excedido. Coloque o dedo no leitor e tente novamente.'));
      }, 20000);

      uareu.dpfpddCaptureAsync(
        leitor,
        CONSTANTS.DPFPDD_IMAGE_FMT.DPFPDD_IMG_FMT_ANSI381,
        CONSTANTS.DPFPDD_IMAGE_PROC.DPFPDD_IMG_PROC_DEFAULT,
        (data, dataSize) => {
          clearTimeout(timeout);
          resolve({ data, dataSize });
        },
        (error) => {
          clearTimeout(timeout);
          reject(new ApiError(500, 'CAPTURE_ERROR', 'Erro ao capturar a biometria do dedo.'));
        }
      );
    });

    const fmd = await uareu.dpfjCreateFmdFromFid(
      dados.data,
      CONSTANTS.DPFJ_FMD_FORMAT.DPFJ_FMD_ANSI_378_2004
    );

    valorBiometria = Buffer.from(JSON.stringify({ fmd }));
    
    // Salva o buffer capturado como imagem
    salvarImagemBmp(dados.data, usuarioId);
  }

  const result = biometriaModel.salvarBiometria(Number(usuarioId), valorBiometria);

  if (result.changes !== 1) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado para salvar biometria.');
  }

  res.status(201).json({
    ok: true,
    usuarioId: Number(usuarioId),
    mensagem: biometriaRecebida ? 'Biometria salva com sucesso.' : 'Biometria capturada e salva com sucesso.',
  });
}

export async function capturarBiometria(req, res) {
  const { usuarioId } = req.body;

  if (!usuarioId) {
    throw new ApiError(400, 'VALIDATION_ERROR', "O campo 'usuarioId' é obrigatório.");
  }

  const usuario = biometriaModel.buscarBiometria(Number(usuarioId));
  if (!usuario) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado para salvar biometria.');
  }

  if (usuario.biometria !== null) {
    throw new ApiError(409, 'ALREADY_REGISTERED', 'Este usuário já possui uma biometria cadastrada.');
  }

  const leitor = await obterLeitor();

  // Cancela qualquer captura pendente anterior
  try {
    await uareu.dpfpddCancel(leitor);
  } catch (err) {
    // Ignora se não houver captura ativa
  }

  const dados = await new Promise((resolve, reject) => {
    uareu.dpfpddCaptureAsync(
      leitor,
      CONSTANTS.DPFPDD_IMAGE_FMT.DPFPDD_IMG_FMT_ANSI381,
      CONSTANTS.DPFPDD_IMAGE_PROC.DPFPDD_IMG_PROC_DEFAULT,
      (data, dataSize) => {
        resolve({ data, dataSize });
      },
      (error) => reject(error)
    );
  });

  const fmd = await uareu.dpfjCreateFmdFromFid(
    dados.data,
    CONSTANTS.DPFJ_FMD_FORMAT.DPFJ_FMD_ANSI_378_2004
  );

  const resultado = biometriaModel.salvarBiometria(Number(usuarioId), Buffer.from(JSON.stringify({ fmd })));

  if (resultado.changes !== 1) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado para salvar biometria.');
  }

  // Salva o buffer capturado como imagem
  salvarImagemBmp(dados.data, usuarioId);

  res.status(201).json({
    ok: true,
    usuarioId: Number(usuarioId),
    mensagem: 'Biometria capturada e salva com sucesso.',
  });
}

export async function alterarBiometria(req, res) {
  const { usuarioId } = req.body;

  if (!usuarioId) {
    throw new ApiError(400, 'VALIDATION_ERROR', "O campo 'usuarioId' é obrigatório.");
  }

  const usuario = biometriaModel.buscarBiometria(Number(usuarioId));
  if (!usuario) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');
  }

  if (usuario.biometria === null) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Este usuário não possui biometria cadastrada para alterar. Use a rota de cadastro primeiro.');
  }

  let valorBiometria;
  const biometriaRecebida = normalizarBiometria(
    req.body?.biometria ?? req.body?.template ?? req.body?.fmd ?? req.body?.fingerprint
  );

  if (biometriaRecebida) {
    valorBiometria = Buffer.from(biometriaRecebida, 'base64');
  } else {
    const leitor = await obterLeitor();

    try {
      await uareu.dpfpddCancel(leitor);
    } catch (err) {}

    const dados = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        uareu.dpfpddCancel(leitor).catch(() => {});
        reject(new ApiError(408, 'CAPTURE_TIMEOUT', 'Tempo limite excedido. Coloque o dedo no leitor e tente novamente.'));
      }, 20000);

      uareu.dpfpddCaptureAsync(
        leitor,
        CONSTANTS.DPFPDD_IMAGE_FMT.DPFPDD_IMG_FMT_ANSI381,
        CONSTANTS.DPFPDD_IMAGE_PROC.DPFPDD_IMG_PROC_DEFAULT,
        (data, dataSize) => {
          clearTimeout(timeout);
          resolve({ data, dataSize });
        },
        (error) => {
          clearTimeout(timeout);
          reject(new ApiError(500, 'CAPTURE_ERROR', 'Erro ao capturar a biometria do dedo.'));
        }
      );
    });

    const fmd = await uareu.dpfjCreateFmdFromFid(
      dados.data,
      CONSTANTS.DPFJ_FMD_FORMAT.DPFJ_FMD_ANSI_378_2004
    );

    valorBiometria = Buffer.from(JSON.stringify({ fmd }));

    // Salva o buffer capturado como imagem
    salvarImagemBmp(dados.data, usuarioId);
  }

  const result = biometriaModel.salvarBiometria(Number(usuarioId), valorBiometria);

  if (result.changes !== 1) {
    throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado para salvar biometria.');
  }

  res.status(200).json({
    ok: true,
    usuarioId: Number(usuarioId),
    mensagem: biometriaRecebida ? 'Biometria alterada com sucesso.' : 'Biometria capturada e alterada com sucesso.',
  });
}
