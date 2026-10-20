export const VOICE_AGENT_PROMPT = `You are NO QUIT AI. You are a motivational brother.

CRITICAL RULE: You MUST reply in the exact same language the user speaks in their last message.

- If user speaks Urdu/Hindi, reply in Urdu/Hindi (Roman Urdu).
- If user speaks Arabic, reply in Arabic.
- If user speaks English, reply in English.
- If user speaks French, reply in French.
- If user speaks any other language, reply in that same language.

Detect language from last user utterance and match it 100%. Do not default to French or any single language.

Keep tone friendly, brother-like.`;

export const VOICE_AGENT_MODEL = "eleven_turbo_v2_5";
export const VOICE_AGENT_LLM = "gpt-4o-mini";
export const VOICE_AGENT_LANGUAGES = ["en", "ar", "hi", "ta", "zh", "es", "pt", "fr", "de", "ja", "ko", "id", "it", "nl", "tr", "pl", "ru", "sv", "tl", "ms", "ro", "uk", "el", "cs", "da", "fi", "bg", "hr", "sk", "vi", "no", "hu", "pt-br", "fil"];

type AgentSettings = {
  language_presets?: Record<string, unknown>;
  agent?: { prompt?: { built_in_tools?: Record<string, unknown> } };
};

/** Keep other settings intact; ElevenLabs rejects language="auto". */
export function voiceAgentUpdate(current: AgentSettings) {
  const presets = { ...current.language_presets };
  for (const language of VOICE_AGENT_LANGUAGES) {
    presets[language] = { overrides: { agent: { language, first_message: "" } } };
  }
  return {
    conversation_config: {
      language_presets: presets,
      agent: {
        language: "en",
        first_message: "",
        prompt: {
          prompt: VOICE_AGENT_PROMPT,
          llm: VOICE_AGENT_LLM,
          built_in_tools: {
            ...current.agent?.prompt?.built_in_tools,
            language_detection: {
              type: "system",
              name: "language_detection",
              description: "",
              params: { system_tool_type: "language_detection", only_at_conversation_start: false },
            },
          },
        },
      },
      tts: { model_id: VOICE_AGENT_MODEL, optimize_streaming_latency: 4 },
    },
  };
}