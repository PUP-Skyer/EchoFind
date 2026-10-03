// ---- plugin:echofind_voice_to_text_1 ----
// ============================================================
// 插件 echofind_voice_to_text_1 (EchoFind中控台小寻助手语音识别) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface EchofindVoiceToTextOneInput {
  /** 用户录音生成的音频文件URL */
  audio_url: string[];
  /** 语音识别语言代码，可选值：zh（中文普通话）、en（英语）、ja（日语）、ko（韩语）、fr（法语）、es（西班牙语）、pt（葡萄牙语）、id（印尼语）、ru（俄语）、ms（马来语） */
  language: string;
}

/**
 * capabilityClient.load('echofind_voice_to_text_1').call<EchofindVoiceToTextOneOutput>('speechToText', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { text } = result;
 * 返回值形如：
 *   {"text":"示例文本"}
 */
export interface EchofindVoiceToTextOneOutput {
  /** [object Object] */
  text: string;
}
// ---- end:echofind_voice_to_text_1 ----

// ---- plugin:echofind_xiaoxun_ai_chat_1 ----
// ============================================================
// 插件 echofind_xiaoxun_ai_chat_1 (EchoFind中控台小寻AI助手对话生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface EchofindXiaoxunAiChatOneInput {
  /** 历史对话上下文，包含多轮用户提问和助手回复记录 */
  dialog_context: string;
  /** 用户当前最新的提问内容 */
  user_question: string;
}

/**
 * capabilityClient.load('echofind_xiaoxun_ai_chat_1').callStream<EchofindXiaoxunAiChatOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 EchofindXiaoxunAiChatOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface EchofindXiaoxunAiChatOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  response?: string;
}
// ---- end:echofind_xiaoxun_ai_chat_1 ----

// ---- plugin:echofind_xiaoxun_item_photo_recognition_1 ----
// ============================================================
// 插件 echofind_xiaoxun_item_photo_recognition_1 (EchoFind小寻AI助手物品拍照识别) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface EchofindXiaoxunItemPhotoRecognitionOneInput {
  /** 用户上传的待识别物品照片 */
  item_photo: string[];
}

/**
 * capabilityClient.load('echofind_xiaoxun_item_photo_recognition_1').callStream<EchofindXiaoxunItemPhotoRecognitionOneOutput>('imageUnderstanding', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 EchofindXiaoxunItemPhotoRecognitionOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","reasoningContent":"","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface EchofindXiaoxunItemPhotoRecognitionOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  reasoningContent?: string;
  /** [object Object] */
  response?: string;
}
// ---- end:echofind_xiaoxun_item_photo_recognition_1 ----

// ---- plugin:echofind_xiaoxun_speech_broadcast_1 ----
// ============================================================
// 插件 echofind_xiaoxun_speech_broadcast_1 (EchoFind小寻AI助手语音播报) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface EchofindXiaoxunSpeechBroadcastOneInput {
  /** 物品所在位置信息 */
  item_location: string;
  /** 需要播报的物品信息 */
  item_info: string;
}

/**
 * capabilityClient.load('echofind_xiaoxun_speech_broadcast_1').call<EchofindXiaoxunSpeechBroadcastOneOutput>('speechSynthesis', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { audioUrl } = result;
 * 返回值形如：
 *   {"audioUrl":"示例文本"}
 */
export interface EchofindXiaoxunSpeechBroadcastOneOutput {
  /** [object Object] */
  audioUrl: string;
}
// ---- end:echofind_xiaoxun_speech_broadcast_1 ----