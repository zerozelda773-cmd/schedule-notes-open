package org.synthetic.schedulenotes;


final class PptxTransferBuffer {
    static final int MAX_ENCODED_CHARS = 45 * 1024 * 1024;
    static final int MAX_CHUNK_CHARS = 96 * 1024;
    static final class Transfer {
        final String id, filename, base64;
        Transfer(String id, String filename, String base64) { this.id = id; this.filename = filename; this.base64 = base64; }
    }
    private String id, filename;
    private int expectedLength, nextIndex;
    private StringBuilder encoded;
    private final java.util.Set<String> allowedExtensions;
    PptxTransferBuffer(String... extensions) {
        allowedExtensions = new java.util.HashSet<>(java.util.Arrays.asList(extensions.length == 0 ? new String[]{".pptx"} : extensions));
    }

    synchronized String begin(String requestId, String requestedFilename, int totalChars) {
        if (id != null) return "已有 PPT 正在传输，请稍后重试。";
        if (requestId == null || !requestId.matches("[A-Za-z0-9_-]{1,80}") || requestedFilename == null ||
            allowedExtensions.stream().noneMatch(requestedFilename::endsWith) || totalChars < 4 || totalChars > MAX_ENCODED_CHARS) return "文档传输参数无效。";
        id = requestId; filename = requestedFilename; expectedLength = totalChars; nextIndex = 0;
        encoded = new StringBuilder(totalChars);
        return "";
    }

    synchronized String append(String requestId, int index, String chunk) {
        if (!matches(requestId) || index != nextIndex || chunk == null || chunk.isEmpty() || chunk.length() > MAX_CHUNK_CHARS ||
            encoded.length() + chunk.length() > expectedLength || !chunk.matches("[A-Za-z0-9+/=]+")) {
            reset(); return "PPT 分块传输中断，请重新生成。";
        }
        encoded.append(chunk); nextIndex += 1;
        return "";
    }

    synchronized Transfer finish(String requestId) {
        if (!matches(requestId) || encoded.length() != expectedLength) { reset(); return null; }
        Transfer value = new Transfer(id, filename, encoded.toString()); reset(); return value;
    }

    synchronized void cancel(String requestId) { if (matches(requestId)) reset(); }
    private boolean matches(String requestId) { return id != null && id.equals(requestId); }
    private void reset() { id = null; filename = null; expectedLength = 0; nextIndex = 0; encoded = null; }
}
