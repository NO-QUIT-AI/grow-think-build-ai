// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { voiceAgentUpdate } from "./voice-agent-config";

describe("voice agent configuration", () => {
  it("uses the low-latency turbo voice, fast LLM and max latency optimization", () => {
    expect(voiceAgentUpdate({}).conversation_config.tts.model_id).toBe("eleven_flash_v2_5");
    expect(voiceAgentUpdate({}).conversation_config.tts.optimize_streaming_latency).toBe(4);
    expect(voiceAgentUpdate({}).conversation_config.agent.prompt.llm).toBe("gpt-4o-mini");
  });
  it("allows language detection throughout the call", () => {
    const tool = voiceAgentUpdate({}).conversation_config.agent.prompt.built_in_tools.language_detection;
    expect(tool.params.system_tool_type).toBe("language_detection");
    expect(tool.params.only_at_conversation_start).toBe(false);
  });
  it("enables English, Arabic and Hindi switching", () => {
    const presets = voiceAgentUpdate({}).conversation_config.language_presets;
    for (const language of ["en", "ar", "hi"]) {
      expect(presets[language]).toEqual({ overrides: { agent: { language, first_message: "" } } });
    }
  });
  it("preserves other system tools and keeps a silent start", () => {
    const config = voiceAgentUpdate({ agent: { prompt: { built_in_tools: { end_call: { name: "end_call" } } } } }).conversation_config;
    expect(config.agent.prompt.built_in_tools.end_call).toEqual({ name: "end_call" });
    expect(config.agent.first_message).toBe("");
  });
});