(function initExcelLocalReader(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ExcelLocalReader = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  class ExcelReadError extends Error {
    constructor(code, message, cause) {
      super(message);
      this.name = 'ExcelReadError';
      this.code = code;
      if (cause) this.cause = cause;
    }
  }

  const bytes = (value) => {
    if (value instanceof Uint8Array) return value;
    if (Array.isArray(value)) return Uint8Array.from(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new ExcelReadError('INVALID_INPUT', '无法读取所选文件。');
  };

  const fileStemPassword = (name = '') => String(name).replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').trim();
  const uint32 = (input, offset) => new DataView(input.buffer, input.byteOffset, input.byteLength).getUint32(offset, true);
  const uint16 = (input, offset) => new DataView(input.buffer, input.byteOffset, input.byteLength).getUint16(offset, true);

  function wordArrayFromBytes(input, CryptoJS) {
    const words = [];
    for (let i = 0; i < input.length; i += 1) words[i >>> 2] = (words[i >>> 2] || 0) | (input[i] << (24 - (i % 4) * 8));
    return CryptoJS.lib.WordArray.create(words, input.length);
  }

  function bytesFromWordArray(wordArray) {
    const result = new Uint8Array(wordArray.sigBytes);
    for (let i = 0; i < result.length; i += 1) result[i] = (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    return result;
  }

  function concatBytes(...parts) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const result = new Uint8Array(length); let offset = 0;
    parts.forEach((part) => { result.set(part, offset); offset += part.length; });
    return result;
  }

  function sha1(input, CryptoJS) {
    return bytesFromWordArray(CryptoJS.SHA1(wordArrayFromBytes(input, CryptoJS)));
  }

  function utf16le(value) {
    const output = new Uint8Array(value.length * 2);
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i); output[i * 2] = code & 0xff; output[i * 2 + 1] = code >>> 8;
    }
    return output;
  }

  function deriveStandardKey(password, salt, keyBits, CryptoJS) {
    let hash = sha1(concatBytes(salt, utf16le(password)), CryptoJS);
    for (let i = 0; i < 50000; i += 1) {
      const iteration = new Uint8Array(4); new DataView(iteration.buffer).setUint32(0, i, true);
      hash = sha1(concatBytes(iteration, hash), CryptoJS);
    }
    const block = new Uint8Array(4);
    const finalHash = sha1(concatBytes(hash, block), CryptoJS);
    const inner = new Uint8Array(64).fill(0x36); const outer = new Uint8Array(64).fill(0x5c);
    for (let i = 0; i < finalHash.length; i += 1) { inner[i] ^= finalHash[i]; outer[i] ^= finalHash[i]; }
    return concatBytes(sha1(inner, CryptoJS), sha1(outer, CryptoJS)).slice(0, keyBits / 8);
  }

  function aesEcbDecrypt(input, key, CryptoJS) {
    const params = CryptoJS.lib.CipherParams.create({ ciphertext: wordArrayFromBytes(input, CryptoJS) });
    const decrypted = CryptoJS.AES.decrypt(params, wordArrayFromBytes(key, CryptoJS), { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.NoPadding });
    return bytesFromWordArray(decrypted);
  }

  function parseStandardEncryptionInfo(content) {
    const input = bytes(content);
    if (input.length < 96 || uint16(input, 0) !== 4 || uint16(input, 2) !== 2) throw new ExcelReadError('UNSUPPORTED_ENCRYPTION', '该 Excel 加密格式暂不支持。');
    const headerSize = uint32(input, 8);
    const keyBits = uint32(input, 28);
    const verifierOffset = 12 + headerSize;
    const saltSize = uint32(input, verifierOffset);
    if (saltSize !== 16 || keyBits !== 128 || verifierOffset + 72 > input.length) throw new ExcelReadError('UNSUPPORTED_ENCRYPTION', '该 Excel 加密参数暂不支持。');
    return {
      keyBits,
      salt: input.slice(verifierOffset + 4, verifierOffset + 20),
      verifier: input.slice(verifierOffset + 20, verifierOffset + 36),
      verifierHashSize: uint32(input, verifierOffset + 36),
      verifierHash: input.slice(verifierOffset + 40, verifierOffset + 72),
    };
  }

  function decryptStandard(input, password, XLSX, CryptoJS) {
    if (!XLSX?.CFB || !CryptoJS?.AES || !CryptoJS?.SHA1) throw new ExcelReadError('COMPONENT_MISSING', '本地 Excel 解密组件未加载。');
    const cfb = XLSX.CFB.read(input, { type: 'array' });
    const infoEntry = XLSX.CFB.find(cfb, '/EncryptionInfo');
    const packageEntry = XLSX.CFB.find(cfb, '/EncryptedPackage');
    if (!infoEntry?.content || !packageEntry?.content) throw new ExcelReadError('UNSUPPORTED_ENCRYPTION', '没有找到可解密的 Excel 数据流。');
    const info = parseStandardEncryptionInfo(infoEntry.content);
    const key = deriveStandardKey(password, info.salt, info.keyBits, CryptoJS);
    const verifier = aesEcbDecrypt(info.verifier, key, CryptoJS);
    const expectedHash = sha1(verifier, CryptoJS).slice(0, info.verifierHashSize);
    const actualHash = aesEcbDecrypt(info.verifierHash, key, CryptoJS).slice(0, info.verifierHashSize);
    if (expectedHash.length !== actualHash.length || expectedHash.some((value, index) => value !== actualHash[index])) {
      throw new ExcelReadError('INVALID_PASSWORD', '文件密码不正确，请手动输入后重试。');
    }
    const encryptedPackage = bytes(packageEntry.content);
    if (encryptedPackage.length < 24) throw new ExcelReadError('DECRYPT_FAILED', '加密工作簿内容不完整。');
    const packageLength = uint32(encryptedPackage, 0);
    const encryptedPayload = encryptedPackage.slice(8);
    const decrypted = aesEcbDecrypt(encryptedPayload, key, CryptoJS);
    return decrypted.slice(0, packageLength);
  }

  function encryptionVersion(input, XLSX) {
    try {
      const cfb = XLSX?.CFB?.read(input, { type: 'array' });
      const entry = XLSX?.CFB?.find(cfb, '/EncryptionInfo');
      if (!entry?.content) return null;
      const info = bytes(entry.content);
      return { major: uint16(info, 0), minor: uint16(info, 2) };
    } catch { return null; }
  }

  async function decryptAgile(input, password, XlsxPopulate) {
    if (!XlsxPopulate?.fromDataAsync) throw new ExcelReadError('UNSUPPORTED_ENCRYPTION', '该文件使用 Agile 加密，但相应离线组件未加载。');
    try {
      const source = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
      const workbook = await XlsxPopulate.fromDataAsync(source, { password });
      return bytes(await workbook.outputAsync('uint8array'));
    } catch (error) {
      throw new ExcelReadError('INVALID_PASSWORD', '文件密码不正确，请手动输入后重试。', error);
    }
  }

  async function readWorkbook(source, options = {}) {
    const XLSX = options.XLSX || globalThis.XLSX;
    const CryptoJS = options.CryptoJS || globalThis.CryptoJS;
    const XlsxPopulate = options.XlsxPopulate || globalThis.XlsxPopulate;
    if (!XLSX?.read) throw new ExcelReadError('COMPONENT_MISSING', 'Excel 解析组件未加载。');
    const input = bytes(source?.arrayBuffer ? await source.arrayBuffer() : source);
    const fileName = options.fileName || source?.name || '';
    try {
      return { workbook: XLSX.read(input, { type: 'array', cellDates: true }), encrypted: false, passwordSource: 'none' };
    } catch (plainError) {
      const version = encryptionVersion(input, XLSX);
      if (!version) throw new ExcelReadError('PARSE_FAILED', 'Excel 文件无法解析，请检查文件格式。', plainError);
      const automaticPassword = fileStemPassword(fileName);
      const attempts = [];
      if (options.password !== undefined && String(options.password)) attempts.push({ value: String(options.password), source: 'manual' });
      else if (automaticPassword) attempts.push({ value: automaticPassword, source: 'filename' });
      if (!attempts.length) throw new ExcelReadError('PASSWORD_REQUIRED', '该文件已加密，请输入密码。');
      let lastError;
      for (const attempt of attempts) {
        try {
          const decrypted = version.major === 4 && version.minor === 2
            ? decryptStandard(input, attempt.value, XLSX, CryptoJS)
            : await decryptAgile(input, attempt.value, XlsxPopulate);
          return { workbook: XLSX.read(decrypted, { type: 'array', cellDates: true }), encrypted: true, passwordSource: attempt.source };
        } catch (error) { lastError = error; }
      }
      if (options.password === undefined) throw new ExcelReadError('PASSWORD_REQUIRED', '文件名默认密码未通过，请手动输入密码。', lastError);
      throw lastError instanceof ExcelReadError ? lastError : new ExcelReadError('INVALID_PASSWORD', '文件密码不正确，请重试。', lastError);
    }
  }

  return { ExcelReadError, fileStemPassword, readWorkbook, decryptStandard, encryptionVersion };
}));
