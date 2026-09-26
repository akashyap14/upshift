package com.upshift.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JsonRepairTest {

    @Test
    void closesMissingTrailingBrace() {
        // Real failure seen from the model: final "}" dropped.
        assertEquals("{\"questions\": [{\"q\": \"x\"}]}", AiService.closeUnbalancedJson("{\"questions\": [{\"q\": \"x\"}]"));
    }

    @Test
    void closesSeveralLevels() {
        assertEquals("{\"a\": [{\"b\": [1]}]}", AiService.closeUnbalancedJson("{\"a\": [{\"b\": [1"));
    }

    @Test
    void ignoresBracketsInsideStrings() {
        String json = "{\"q\": \"what does { or [ mean? \\\"}\\\"\"";
        assertEquals(json + "}", AiService.closeUnbalancedJson(json));
    }

    @Test
    void leavesValidJsonUnchanged() {
        String json = "{\"a\": [1, 2]}";
        assertEquals(json, AiService.closeUnbalancedJson(json));
    }

    @Test
    void leavesMismatchedOrUnterminatedStringAlone() {
        assertEquals("{\"a\": [1}", AiService.closeUnbalancedJson("{\"a\": [1}"));
        assertEquals("{\"a\": \"unterminated", AiService.closeUnbalancedJson("{\"a\": \"unterminated"));
    }
}
