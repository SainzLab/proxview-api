import crypto from 'crypto';

const CAPTCHA_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CAPTCHA_LENGTH = 6;
export const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const MAX_CAPTCHA_STORE_SIZE = 5000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const captchaStore = new Map();

const GLYPH_STROKES = {
    A: [[[0, 14], [5, 0], [10, 14]], [[2, 9.5], [8, 9.5]]],
    B: [[[1, 0], [1, 14]], [[1, 0], [7, 0], [9.5, 2], [9.5, 5], [7, 7], [1, 7]], [[7, 7], [10, 9], [10, 12], [7.5, 14], [1, 14]]],
    C: [[[9.5, 3], [7.5, 0.5], [3, 0.5], [0.5, 3.5], [0.5, 10.5], [3, 13.5], [7.5, 13.5], [9.5, 11]]],
    D: [[[1, 0], [1, 14]], [[1, 0], [6.5, 0], [9.5, 3.5], [9.5, 10.5], [6.5, 14], [1, 14]]],
    E: [[[9, 0], [1, 0], [1, 14], [9, 14]], [[1, 7], [7.5, 7]]],
    F: [[[9, 0], [1, 0], [1, 14]], [[1, 7], [7.5, 7]]],
    G: [[[9.5, 3], [7.5, 0.5], [3, 0.5], [0.5, 3.5], [0.5, 10.5], [3, 13.5], [8, 13.5], [9.5, 11], [9.5, 7.5], [5.5, 7.5]]],
    H: [[[1, 0], [1, 14]], [[9, 0], [9, 14]], [[1, 7], [9, 7]]],
    J: [[[3, 0], [9.5, 0]], [[6.5, 0], [6.5, 11], [4.5, 13.5], [1.5, 13.5], [0.5, 11]]],
    K: [[[1, 0], [1, 14]], [[9, 0], [1.5, 7.5]], [[3.5, 5.5], [9.5, 14]]],
    M: [[[0.5, 14], [0.5, 0], [5, 8], [9.5, 0], [9.5, 14]]],
    N: [[[1, 14], [1, 0], [9, 14], [9, 0]]],
    P: [[[1, 14], [1, 0], [7, 0], [9.5, 2], [9.5, 5.5], [7, 7.5], [1, 7.5]]],
    Q: [[[3, 0.5], [7, 0.5], [9.5, 3.5], [9.5, 10], [7, 13], [3, 13], [0.5, 10], [0.5, 3.5], [3, 0.5]], [[6, 9.5], [10, 14]]],
    R: [[[1, 14], [1, 0], [7, 0], [9.5, 2], [9.5, 5.5], [7, 7.5], [1, 7.5]], [[5.5, 7.5], [9.5, 14]]],
    S: [[[9, 2.5], [7, 0.5], [2.5, 0.5], [0.5, 2.5], [0.5, 5], [2.5, 6.5], [7.5, 7.5], [9.5, 9.5], [9.5, 12], [7.5, 13.5], [2.5, 13.5], [0.5, 11.5]]],
    T: [[[0.5, 0], [9.5, 0]], [[5, 0], [5, 14]]],
    U: [[[1, 0], [1, 10.5], [3, 13.5], [7, 13.5], [9, 10.5], [9, 0]]],
    V: [[[0.5, 0], [5, 14], [9.5, 0]]],
    W: [[[0, 0], [2.5, 14], [5, 5.5], [7.5, 14], [10, 0]]],
    X: [[[1, 0], [9, 14]], [[9, 0], [1, 14]]],
    Y: [[[0.5, 0], [5, 7.5], [9.5, 0]], [[5, 7.5], [5, 14]]],
    Z: [[[1, 0], [9, 0], [1, 14], [9, 14]]],
    2: [[[1, 3], [3, 0.5], [7, 0.5], [9, 2.5], [9, 5.5], [1, 14], [9.5, 14]]],
    3: [[[1, 2], [3, 0.5], [7, 0.5], [9, 2.5], [9, 5], [6.5, 7], [4, 7]], [[6.5, 7], [9.5, 9], [9.5, 12], [7, 13.5], [3, 13.5], [1, 11.5]]],
    4: [[[7.5, 14], [7.5, 0], [0.5, 9.5], [9.5, 9.5]]],
    5: [[[9, 0.5], [1.5, 0.5], [1, 6.5], [6.5, 6], [9.5, 8], [9.5, 11.5], [7, 13.5], [2.5, 13.5], [0.5, 11.5]]],
    6: [[[8.5, 2], [6.5, 0.5], [3, 0.5], [1, 3.5], [1, 11], [3, 13.5], [7, 13.5], [9, 11.5], [9, 8.5], [7, 6.5], [3, 6.5], [1, 8.5]]],
    7: [[[1, 0.5], [9.5, 0.5], [3.5, 14]]],
    8: [[[3, 7], [1, 5], [1, 2], [3, 0.5], [7, 0.5], [9, 2], [9, 5], [7, 7], [3, 7], [0.5, 9], [0.5, 12], [3, 13.5], [7, 13.5], [9.5, 12], [9.5, 9], [7, 7]]],
    9: [[[1.5, 12], [3.5, 13.5], [7, 13.5], [9, 10.5], [9, 3], [7, 0.5], [3, 0.5], [1, 2.5], [1, 5.5], [3, 7.5], [7, 7.5], [9, 5.5]]]
};

const hashCode = (value) => {
    return crypto.createHash('sha256').update(value).digest();
};

const randomFloat = (min, max) => {
    const rand = crypto.randomInt(0, 1000000) / 1000000;
    return min + rand * (max - min);
};

const shuffleInPlace = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const pruneExpiredCaptchas = () => {
    const now = Date.now();
    for (const [id, entry] of captchaStore.entries()) {
        if (now >= entry.expiresAt) {
            captchaStore.delete(id);
        }
    }

    if (captchaStore.size >= MAX_CAPTCHA_STORE_SIZE) {
        const overflow = captchaStore.size - MAX_CAPTCHA_STORE_SIZE + 1;
        let removed = 0;
        for (const key of captchaStore.keys()) {
            captchaStore.delete(key);
            removed++;
            if (removed >= overflow) break;
        }
    }
};

const cleanupTimer = setInterval(pruneExpiredCaptchas, CLEANUP_INTERVAL_MS);
if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
}

const buildCaptchaVectorScene = (code) => {
    const width = 130;
    const height = 35;
    const glyphPaths = [];

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const strokes = GLYPH_STROKES[char] || [];
        const scale = randomFloat(1.04, 1.18);
        const angle = randomFloat(-0.22, 0.22);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const slotX = 14 + i * 19.8 + randomFloat(-1.1, 1.1);
        const slotY = height / 2 + randomFloat(-2.2, 2.2);

        for (const stroke of strokes) {
            const cmds = stroke.map(([px, py], idx) => {
                const cx = (px - 5) * scale + randomFloat(-0.32, 0.32);
                const cy = (py - 7) * scale + randomFloat(-0.32, 0.32);
                const rx = cx * cosA - cy * sinA + slotX;
                const ry = cx * sinA + cy * cosA + slotY;
                return `${idx === 0 ? 'M' : 'L'}${rx.toFixed(2)} ${ry.toFixed(2)}`;
            });
            glyphPaths.push(cmds.join(' '));
        }
    }

    shuffleInPlace(glyphPaths);

    const noiseCurves = [];
    for (let i = 0; i < 4; i++) {
        const x1 = randomFloat(2, 25).toFixed(1);
        const y1 = randomFloat(3, height - 3).toFixed(1);
        const cx1 = randomFloat(30, 65).toFixed(1);
        const cy1 = randomFloat(1, height - 1).toFixed(1);
        const cx2 = randomFloat(65, 100).toFixed(1);
        const cy2 = randomFloat(1, height - 1).toFixed(1);
        const x2 = randomFloat(105, width - 2).toFixed(1);
        const y2 = randomFloat(3, height - 3).toFixed(1);
        noiseCurves.push({
            d: `M${x1} ${y1} C${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
            primary: i < 2
        });
    }

    const noiseDots = [];
    for (let i = 0; i < 14; i++) {
        noiseDots.push({
            cx: randomFloat(4, width - 4).toFixed(1),
            cy: randomFloat(4, height - 4).toFixed(1),
            r: randomFloat(0.7, 1.3).toFixed(1)
        });
    }

    return { width, height, glyphPaths, noiseCurves, noiseDots };
};

const renderSceneToDataUri = (scene, isDarkTheme) => {
    const bg = isDarkTheme ? '#0f172a' : '#f8fafc';
    const fg = isDarkTheme ? '#f8fafc' : '#1e293b';
    const accent = '#10b981';
    const muted = isDarkTheme ? '#475569' : '#cbd5e1';

    const dotsMarkup = scene.noiseDots
        .map((d) => `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${muted}" opacity="0.75"/>`)
        .join('');

    const glyphMarkup = scene.glyphPaths
        .map((d) => `<path d="${d}" fill="none" stroke="${fg}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"/>`)
        .join('');

    const curvesMarkup = scene.noiseCurves
        .map((c) => `<path d="${c.d}" fill="none" stroke="${c.primary ? accent : muted}" stroke-width="${c.primary ? '1.35' : '1.0'}" opacity="${c.primary ? '0.8' : '0.55'}" stroke-linecap="round"/>`)
        .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><rect width="100%" height="100%" fill="${bg}"/>${dotsMarkup}${glyphMarkup}${curvesMarkup}</svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
};

export const invalidateCaptcha = (captchaId) => {
    if (typeof captchaId === 'string' && captchaId.length > 0) {
        captchaStore.delete(captchaId);
    }
};

export const createCaptchaChallenge = () => {
    pruneExpiredCaptchas();

    let code = '';
    for (let i = 0; i < CAPTCHA_LENGTH; i++) {
        code += CAPTCHA_CHARSET[crypto.randomInt(0, CAPTCHA_CHARSET.length)];
    }

    const captchaId = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + CAPTCHA_TTL_MS;

    captchaStore.set(captchaId, {
        codeHash: hashCode(code),
        expiresAt
    });

    const scene = buildCaptchaVectorScene(code);

    return {
        captchaId,
        image: renderSceneToDataUri(scene, false),
        imageDark: renderSceneToDataUri(scene, true),
        expiresIn: Math.floor(CAPTCHA_TTL_MS / 1000)
    };
};

export const verifyAndConsumeCaptcha = (captchaId, captchaInput) => {
    if (typeof captchaId !== 'string' || !captchaId.trim() || typeof captchaInput !== 'string' || !captchaInput.trim()) {
        if (typeof captchaId === 'string' && captchaId.trim()) {
            captchaStore.delete(captchaId.trim());
        }
        return {
            valid: false,
            code: 'CAPTCHA_REQUIRED',
            message: 'Verifikasi CAPTCHA wajib diisi.'
        };
    }

    const normalizedId = captchaId.trim();
    const entry = captchaStore.get(normalizedId);

    captchaStore.delete(normalizedId);

    if (!entry || Date.now() >= entry.expiresAt) {
        return {
            valid: false,
            code: 'CAPTCHA_EXPIRED',
            message: 'Kode CAPTCHA tidak valid atau telah kedaluwarsa. Silakan coba lagi.'
        };
    }

    const normalizedInput = captchaInput.trim().toUpperCase();
    const inputHash = hashCode(normalizedInput);

    const isMatch =
        inputHash.length === entry.codeHash.length &&
        crypto.timingSafeEqual(inputHash, entry.codeHash);

    if (!isMatch) {
        return {
            valid: false,
            code: 'CAPTCHA_INVALID',
            message: 'Kode CAPTCHA tidak sesuai, silakan coba lagi.'
        };
    }

    return { valid: true };
};
