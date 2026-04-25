import type { Request, Response } from 'express';

import { answerAssistantQueryForOwner, type AssistantQueryInput } from '../models/assistant.model';

type AssistantQueryBody = {
  clientInteractionId?: unknown;
  questionText?: unknown;
  inputMode?: unknown;
  outputMode?: unknown;
};

function isValidMode(value: unknown, allowed: string[]) {
  return typeof value === 'string' && allowed.includes(value);
}

function isValidAssistantQueryBody(value: AssistantQueryBody): value is AssistantQueryInput {
  return (
    typeof value.clientInteractionId === 'string' &&
    value.clientInteractionId.trim().length > 0 &&
    typeof value.questionText === 'string' &&
    value.questionText.trim().length > 0 &&
    isValidMode(value.inputMode, ['voice', 'text']) &&
    isValidMode(value.outputMode, ['text', 'speech', 'text_and_speech'])
  );
}

export async function queryAssistant(req: Request<unknown, unknown, AssistantQueryBody>, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const payload = req.body ?? {};
  if (!isValidAssistantQueryBody(payload)) {
    return res.status(400).json({
      message: 'Invalid assistant query payload.',
    });
  }

  const result = await answerAssistantQueryForOwner(user.id, {
    clientInteractionId: payload.clientInteractionId.trim(),
    questionText: payload.questionText.trim(),
    inputMode: payload.inputMode,
    outputMode: payload.outputMode,
  });

  return res.status(200).json({
    clientInteractionId: result.clientInteractionId,
    status: result.status,
    answerText: result.answerText,
    spokenText: result.spokenText,
    actions: result.actions,
  });
}
