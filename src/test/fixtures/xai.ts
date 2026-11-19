/** Responses in the shape the xAI API returns. The live job checks these keys still exist. */

export const xaiChat = (content: string) => ({
  id: "chatcmpl-1",
  object: "chat.completion",
  model: "grok-4.5",
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
});

/** A 1x1 JPEG is enough: the app passes the bytes through without decoding them. */
export const TINY_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z";

export const xaiImage = () => ({ data: [{ b64_json: TINY_JPEG_B64 }] });

export const xaiVideoStarted = (requestId = "req_12345678") => ({ request_id: requestId });

export const XAI_KEYS = {
  chat: ["choices"],
  chatChoice: ["message"],
  image: ["data"],
};
