package org.synthetic.schedulenotes;

import static org.junit.Assert.*;
import org.junit.Test;

public class PptxTransferBufferTest {
    @Test public void reassemblesLargePayloadInOrder() {
        PptxTransferBuffer buffer = new PptxTransferBuffer();
        String value = "UEsDB" + "A".repeat(1024 * 1024);
        assertEquals("", buffer.begin("ppt_1", "FY2026-Q3-Primary Product A.pptx", value.length()));
        int index = 0;
        for (int start = 0; start < value.length(); start += 65536) assertEquals("", buffer.append("ppt_1", index++, value.substring(start, Math.min(value.length(), start + 65536))));
        PptxTransferBuffer.Transfer transfer = buffer.finish("ppt_1");
        assertNotNull(transfer); assertEquals(value, transfer.base64);
    }

    @Test public void rejectsOutOfOrderAndOversizedChunks() {
        PptxTransferBuffer buffer = new PptxTransferBuffer();
        assertEquals("", buffer.begin("ppt_2", "report.pptx", 8));
        assertFalse(buffer.append("ppt_2", 1, "UEsD").isEmpty());
        assertNull(buffer.finish("ppt_2"));
    }
    @Test public void applicationBufferDoesNotBroadenThePptBuffer() {
        PptxTransferBuffer applications = new PptxTransferBuffer(".docx", ".xlsx");
        assertFalse(applications.begin("a", "payload.apk", 8).isEmpty());
        assertFalse(applications.begin("a", "report.pptx", 8).isEmpty());
        assertEquals("", applications.begin("a", "申请.docx", 8));
        assertEquals("", applications.append("a", 0, "UEsD"));
        assertEquals("", applications.append("a", 1, "BAAA"));
        assertEquals("UEsDBAAA", applications.finish("a").base64);
        assertFalse(new PptxTransferBuffer().begin("ppt", "申请.docx", 8).isEmpty());
    }
}
