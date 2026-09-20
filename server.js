/**
 * Copilot Ads & Media API Server (Node.js)
 * Maneja subida de videos/imágenes por streaming directo a disco,
 * listado de medios y sincronización de producción.
 * Puerto predeterminado: 3008 (conectado a OpenLiteSpeed proxy /api)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const busboy = require('busboy');

const PORT = parseInt(process.env.PORT, 10) || 3008;
const BASE_DIR = __dirname;
const VIDEOS_DIR = path.join(BASE_DIR, 'assets', 'videos');
const IMAGES_DIR = path.join(BASE_DIR, 'assets', 'images');

// Ruta espejo en servidor de producción
const PROD_MIRROR_BASE = '/home/autobotectesting.site/public_html';
const PROD_UID = 5008; // autob2102
const PROD_GID = 5008; // autob2102

// Asegurar que existan los directorios locales
function ensureDirs() {
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
}
ensureDirs();

// Formatear bytes a tamaño legible
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Sanitizar nombre de archivo (seguro para URLs y sistemas de archivos)
function sanitizeFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext);
  
  // Normalizar acentos y quitar caracteres especiales
  const cleanBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);

  const timestamp = Date.now();
  return `${cleanBase || 'archivo'}_${timestamp}${ext}`;
}

// Espejar archivo al directorio de producción si existe
function mirrorToProduction(relPath, sourceFilePath) {
  try {
    if (!fs.existsSync(PROD_MIRROR_BASE)) return;

    const destPath = path.join(PROD_MIRROR_BASE, relPath);
    const destDir = path.dirname(destPath);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      try {
        fs.chownSync(destDir, PROD_UID, PROD_GID);
        fs.chmodSync(destDir, 0o755);
      } catch (e) {}
    }

    fs.copyFileSync(sourceFilePath, destPath);
    try {
      fs.chownSync(destPath, PROD_UID, PROD_GID);
      fs.chmodSync(destPath, 0o755);
    } catch (e) {}
    console.log(`[MIRROR] Sincronizado a producción: ${destPath}`);
  } catch (err) {
    console.error(`[MIRROR ERROR] No se pudo espejar a ${relPath}:`, err.message);
  }
}

// Eliminar archivo del espejo de producción si existe
function deleteFromProduction(relPath) {
  try {
    if (!fs.existsSync(PROD_MIRROR_BASE)) return;
    const destPath = path.join(PROD_MIRROR_BASE, relPath);
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
      console.log(`[MIRROR] Eliminado de producción: ${destPath}`);
    }
  } catch (err) {
    console.error(`[MIRROR DELETE ERROR]:`, err.message);
  }
}

// Helper CORS
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

// Helper para responder JSON
function sendJson(res, statusCode, data) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// Leer cuerpo JSON
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

// Listar archivos de un directorio
function getFilesFromDir(dir, type, relPrefix) {
  if (!fs.existsSync(dir)) return [];
  try {
    const filenames = fs.readdirSync(dir);
    return filenames
      .filter(name => !name.startsWith('.') && name !== 'Thumbs.db')
      .map(name => {
        const fullPath = path.join(dir, name);
        const stats = fs.statSync(fullPath);
        const relUrl = `${relPrefix}/${name}`;
        return {
          name,
          url: relUrl,
          type,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          mtime: stats.mtime,
          extension: path.extname(name).toLowerCase()
        };
      });
  } catch (e) {
    console.error(`Error leyendo directorio ${dir}:`, e.message);
    return [];
  }
}

// Crear servidor
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. Health check
  if ((pathname === '/api/health' || pathname === '/health') && req.method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'copilot-ads-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      port: PORT
    });
  }

  // 2. Listar medios existentes (videos e imágenes)
  if ((pathname === '/api/media' || pathname === '/media') && req.method === 'GET') {
    ensureDirs();
    const videos = getFilesFromDir(VIDEOS_DIR, 'video', 'assets/videos');
    const images = getFilesFromDir(IMAGES_DIR, 'image', 'assets/images');
    
    // Unir y ordenar por fecha más reciente
    const allFiles = [...videos, ...images].sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

    const totalBytes = allFiles.reduce((acc, f) => acc + f.size, 0);

    return sendJson(res, 200, {
      success: true,
      totalCount: allFiles.length,
      videoCount: videos.length,
      imageCount: images.length,
      totalSizeFormatted: formatBytes(totalBytes),
      files: allFiles
    });
  }

  // 3. Subir archivos (streaming directo a disco)
  if ((pathname === '/api/upload' || pathname === '/upload') && req.method === 'POST') {
    ensureDirs();
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return sendJson(res, 400, { success: false, error: 'Content-Type debe ser multipart/form-data' });
    }

    try {
      const bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: 1024 * 1024 * 1024, // Límite de 1 GB por archivo
          files: 50 // Hasta 50 archivos simultáneos
        }
      });

      const uploadedFiles = [];
      const filePromises = [];

      bb.on('file', (name, fileStream, info) => {
        const { filename, mimeType } = info;
        if (!filename) {
          fileStream.resume();
          return;
        }

        const ext = path.extname(filename).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi'].includes(ext) || mimeType.startsWith('video/');
        const targetDir = isVideo ? VIDEOS_DIR : IMAGES_DIR;
        const relPrefix = isVideo ? 'assets/videos' : 'assets/images';

        const safeFilename = sanitizeFilename(filename);
        const targetFilePath = path.join(targetDir, safeFilename);
        const relUrl = `${relPrefix}/${safeFilename}`;

        const writeStream = fs.createWriteStream(targetFilePath);
        let bytesWritten = 0;

        fileStream.on('data', chunk => {
          bytesWritten += chunk.length;
        });

        const p = new Promise((resolve, reject) => {
          fileStream.pipe(writeStream);
          writeStream.on('finish', () => {
            // Sincronizar al espejo de producción si corresponde
            mirrorToProduction(relUrl, targetFilePath);

            uploadedFiles.push({
              name: safeFilename,
              originalName: filename,
              url: relUrl,
              type: isVideo ? 'video' : 'image',
              size: bytesWritten,
              sizeFormatted: formatBytes(bytesWritten),
              mimeType,
              uploadedAt: new Date().toISOString()
            });
            resolve();
          });
          writeStream.on('error', err => reject(err));
        });

        filePromises.push(p);
      });

      bb.on('close', async () => {
        try {
          await Promise.all(filePromises);
          return sendJson(res, 200, {
            success: true,
            message: uploadedFiles.length > 1
              ? `${uploadedFiles.length} archivos subidos exitosamente`
              : 'Archivo subido exitosamente',
            files: uploadedFiles,
            file: uploadedFiles[0] || null
          });
        } catch (err) {
          console.error('[UPLOAD ERROR]', err);
          return sendJson(res, 500, { success: false, error: 'Error guardando archivo en disco' });
        }
      });

      bb.on('error', err => {
        console.error('[BUSBOY ERROR]', err);
        return sendJson(res, 500, { success: false, error: 'Error procesando la subida' });
      });

      req.pipe(bb);
    } catch (err) {
      console.error('[UPLOAD PROCESS ERROR]', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // 4. Eliminar archivo de medios
  if ((pathname === '/api/media' || pathname === '/media') && req.method === 'DELETE') {
    const body = await parseJsonBody(req);
    const targetPath = body.path || urlObj.searchParams.get('path') || urlObj.searchParams.get('url');

    if (!targetPath) {
      return sendJson(res, 400, { success: false, error: 'Parámetro path es requerido' });
    }

    // Prevención de path traversal
    const normalized = path.normalize(targetPath).replace(/^(\.\.[\/\\])+/, '');
    if (!normalized.startsWith('assets/videos') && !normalized.startsWith('assets/images')) {
      return sendJson(res, 403, { success: false, error: 'Ruta no permitida' });
    }

    const fullLocalPath = path.join(BASE_DIR, normalized);
    if (fs.existsSync(fullLocalPath)) {
      try {
        fs.unlinkSync(fullLocalPath);
        deleteFromProduction(normalized);
        return sendJson(res, 200, { success: true, message: 'Archivo eliminado correctamente' });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: 'No se pudo eliminar el archivo' });
      }
    } else {
      return sendJson(res, 404, { success: false, error: 'Archivo no encontrado' });
    }
  }

  // Ruta no encontrada
  return sendJson(res, 404, { success: false, error: 'Endpoint no encontrado' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Copilot Media & Ads API Server activo`);
  console.log(`📡 Puerto: ${PORT} (0.0.0.0:${PORT})`);
  console.log(`📂 Directorio base: ${BASE_DIR}`);
  console.log(`🎬 Videos: ${VIDEOS_DIR}`);
  console.log(`🖼️  Imágenes: ${IMAGES_DIR}`);
  console.log(`====================================================`);
});
