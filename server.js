/**
 * Copilot Ads & Media API Server (Node.js) - Blindaje de Seguridad
 * Maneja subida de videos/imágenes por streaming directo a disco,
 * listado de medios, sincronización de producción y protección contra ataques.
 * Puerto predeterminado: 3008 (conectado a OpenLiteSpeed proxy /api)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const busboy = require('busboy');

const PORT = parseInt(process.env.PORT, 10) || 3008;
const BIND_HOST = process.env.HOST || '127.0.0.1';
const BASE_DIR = __dirname;
const VIDEOS_DIR = path.join(BASE_DIR, 'assets', 'videos');
const IMAGES_DIR = path.join(BASE_DIR, 'assets', 'images');

// Token administrativo para proteger operaciones de escritura y borrado
const API_ADMIN_TOKEN = process.env.API_ADMIN_TOKEN || 'copilot_admin_sec_2026_x9k';

// Extensiones y formatos estrictamente permitidos (Whitelist defensiva)
const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const DANGEROUS_EXT_REGEX = /\.(php[0-9]?|phtml|phps|phar|sh|bash|exe|cgi|pl|py|js|ts|mjs|cjs|html|htm|svg|htaccess|env)(\.|$)/i;

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

// Verificación de autenticación resistente a timing attacks
function verifyAuthToken(req) {
  const authHeader = req.headers['authorization'] || '';
  const xToken = req.headers['x-admin-token'] || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  } else if (xToken) {
    token = xToken.trim();
  } else {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const qToken = (urlObj.searchParams.get('token') || '').trim();
      if (qToken) {
        console.warn(`[SECURITY WARNING] Token administrativo suministrado por query string en URL. Se recomienda usar cabecera Authorization o X-Admin-Token.`);
        token = qToken;
      }
    } catch (e) {}
  }

  if (!token) return false;

  const expectedBuffer = Buffer.from(API_ADMIN_TOKEN);
  const actualBuffer = Buffer.from(token);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

// Validación estricta de archivo multimedia
function isValidMediaFile(filename, mimeType) {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, reason: 'Nombre de archivo no válido' };
  }

  // Rechazar intentos de doble extensión peligrosa (ej. exploit.php.mp4)
  if (DANGEROUS_EXT_REGEX.test(filename)) {
    return { valid: false, reason: 'El archivo contiene una extensión ejecutable no permitida' };
  }

  const ext = path.extname(filename).toLowerCase();
  const isVideo = ALLOWED_VIDEO_EXTS.has(ext);
  const isImage = ALLOWED_IMAGE_EXTS.has(ext);

  if (!isVideo && !isImage) {
    return {
      valid: false,
      reason: `Extensión no permitida (${ext || 'sin extensión'}). Formatos válidos: mp4, webm, mov, png, jpg, webp.`
    };
  }

  // Validación de MIME type
  const cleanMime = (mimeType || '').toLowerCase();
  if (isVideo && cleanMime && !cleanMime.startsWith('video/') && cleanMime !== 'application/octet-stream') {
    return { valid: false, reason: 'El tipo MIME no coincide con un formato de video' };
  }
  if (isImage && cleanMime && !cleanMime.startsWith('image/') && cleanMime !== 'application/octet-stream') {
    return { valid: false, reason: 'El tipo MIME no coincide con un formato de imagen' };
  }

  return { valid: true, isVideo, ext };
}

// Sanitizar nombre de archivo garantizando unicidad y extensión validada
function sanitizeFilename(originalName, validExt) {
  const base = path.basename(originalName, path.extname(originalName));
  const cleanBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50);

  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  return `${cleanBase || 'media'}_${timestamp}_${randomSuffix}${validExt}`;
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

// Helper CORS y encabezados de seguridad HTTP
function setSecurityAndCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// Helper para responder JSON
function sendJson(res, statusCode, data) {
  setSecurityAndCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// Leer cuerpo JSON
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1048576) { // Límite de 1MB para payloads JSON
        req.destroy();
        resolve({});
      }
    });
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

// Crear servidor HTTP
const server = http.createServer(async (req, res) => {
  setSecurityAndCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. Health check (Público)
  if ((pathname === '/api/health' || pathname === '/health') && (req.method === 'GET' || req.method === 'HEAD')) {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'copilot-ads-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      security: 'hardened'
    });
  }

  // 2. Listar medios existentes (videos e imágenes - Público para la tablet)
  if ((pathname === '/api/media' || pathname === '/media') && (req.method === 'GET' || req.method === 'HEAD')) {
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

  // 3. Subir archivos (Protegido por Token + Whitelist)
  if ((pathname === '/api/upload' || pathname === '/upload') && req.method === 'POST') {
    if (!verifyAuthToken(req)) {
      return sendJson(res, 401, {
        success: false,
        error: 'No autorizado: Token administrativo requerido para subir archivos'
      });
    }

    ensureDirs();
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return sendJson(res, 400, { success: false, error: 'Content-Type debe ser multipart/form-data' });
    }

    try {
      const bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: 150 * 1024 * 1024, // 150 MB límite por video publicitario
          files: 5 // Máximo 5 archivos por solicitud
        }
      });

      const uploadedFiles = [];
      const uploadErrors = [];
      const filePromises = [];

      bb.on('file', (name, fileStream, info) => {
        const { filename, mimeType } = info;
        if (!filename) {
          fileStream.resume();
          return;
        }

        const validation = isValidMediaFile(filename, mimeType);
        if (!validation.valid) {
          fileStream.resume();
          uploadErrors.push(`${filename}: ${validation.reason}`);
          return;
        }

        const isVideo = validation.isVideo;
        const ext = validation.ext;
        const targetDir = isVideo ? VIDEOS_DIR : IMAGES_DIR;
        const relPrefix = isVideo ? 'assets/videos' : 'assets/images';

        const safeFilename = sanitizeFilename(filename, ext);
        const targetFilePath = path.join(targetDir, safeFilename);
        const relUrl = `${relPrefix}/${safeFilename}`;

        const writeStream = fs.createWriteStream(targetFilePath);
        let bytesWritten = 0;
        let fileLimitExceeded = false;

        fileStream.on('data', chunk => {
          bytesWritten += chunk.length;
        });

        fileStream.on('limit', () => {
          fileLimitExceeded = true;
          writeStream.destroy();
          if (fs.existsSync(targetFilePath)) fs.unlinkSync(targetFilePath);
          uploadErrors.push(`${filename}: El archivo excede el tamaño máximo permitido (150 MB)`);
        });

        const p = new Promise((resolve) => {
          fileStream.pipe(writeStream);
          writeStream.on('finish', () => {
            if (fileLimitExceeded) {
              return resolve();
            }
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
          writeStream.on('error', err => {
            uploadErrors.push(`${filename}: Error escribiendo en disco (${err.message})`);
            resolve();
          });
        });

        filePromises.push(p);
      });

      bb.on('close', async () => {
        try {
          await Promise.all(filePromises);

          if (uploadedFiles.length === 0 && uploadErrors.length > 0) {
            return sendJson(res, 415, {
              success: false,
              error: uploadErrors.join(' | ')
            });
          }

          return sendJson(res, 200, {
            success: true,
            message: uploadedFiles.length > 1
              ? `${uploadedFiles.length} archivos subidos exitosamente`
              : 'Archivo subido exitosamente',
            files: uploadedFiles,
            file: uploadedFiles[0] || null,
            warnings: uploadErrors.length > 0 ? uploadErrors : undefined
          });
        } catch (err) {
          console.error('[UPLOAD ERROR]', err);
          return sendJson(res, 500, { success: false, error: 'Error procesando la subida de archivos' });
        }
      });

      bb.on('error', err => {
        console.error('[BUSBOY ERROR]', err);
        return sendJson(res, 500, { success: false, error: 'Error en el procesamiento del flujo multipart' });
      });

      req.pipe(bb);
    } catch (err) {
      console.error('[UPLOAD PROCESS ERROR]', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // 4. Eliminar archivo de medios (Protegido por Token + Anti Path Traversal Canónico)
  if ((pathname === '/api/media' || pathname === '/media') && req.method === 'DELETE') {
    if (!verifyAuthToken(req)) {
      return sendJson(res, 401, {
        success: false,
        error: 'No autorizado: Token administrativo requerido'
      });
    }

    const body = await parseJsonBody(req);
    const targetPath = (body.path || urlObj.searchParams.get('path') || urlObj.searchParams.get('url') || '').trim();

    if (!targetPath) {
      return sendJson(res, 400, { success: false, error: 'Parámetro path es requerido' });
    }

    // Prevención canónica de Path Traversal
    const resolvedPath = path.resolve(BASE_DIR, targetPath);
    const canonicalVideos = path.resolve(VIDEOS_DIR);
    const canonicalImages = path.resolve(IMAGES_DIR);

    const isInsideVideos = resolvedPath.startsWith(canonicalVideos + path.sep);
    const isInsideImages = resolvedPath.startsWith(canonicalImages + path.sep);

    if (!isInsideVideos && !isInsideImages) {
      return sendJson(res, 403, { success: false, error: 'Acceso denegado: Ruta de archivo no autorizada' });
    }

    const relPath = path.relative(BASE_DIR, resolvedPath);

    if (fs.existsSync(resolvedPath)) {
      try {
        fs.unlinkSync(resolvedPath);
        deleteFromProduction(relPath);
        return sendJson(res, 200, {
          success: true,
          message: 'Archivo eliminado correctamente',
          path: relPath
        });
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

server.listen(PORT, BIND_HOST, () => {
  console.log(`====================================================`);
  console.log(`🔒 Copilot Media & Ads API Server Seguro`);
  console.log(`📡 Escuchando en: ${BIND_HOST}:${PORT}`);
  console.log(`📂 Directorio base: ${BASE_DIR}`);
  console.log(`🎬 Videos: ${VIDEOS_DIR}`);
  console.log(`🖼️  Imágenes: ${IMAGES_DIR}`);
  console.log(`🛡️  Protección: Whitelist estricta & Auth Token activos`);
  console.log(`====================================================`);
});
