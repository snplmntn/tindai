import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { getSupabaseAdminClient } from '../config/supabase';
import { answerAssistantQueryForOwner } from '../models/assistant.model';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../models/assistant.model', () => ({
  answerAssistantQueryForOwner: vi.fn(),
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedAnswerAssistantQueryForOwner = vi.mocked(answerAssistantQueryForOwner);

function mockAuthenticatedUser() {
  mockedGetSupabaseAdminClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'owner@tindai.app',
            app_metadata: {},
            user_metadata: {},
          },
        },
        error: null,
      }),
    },
  } as never);
}

describe('POST /api/v1/assistant/query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('answers supported assistant questions for authenticated users', async () => {
    mockAuthenticatedUser();
    mockedAnswerAssistantQueryForOwner.mockResolvedValue({
      clientInteractionId: 'assistant-1',
      status: 'answered',
      answerText: 'Coke Mismo ang pinaka-fast moving today.',
      spokenText: null,
      actions: [],
    });

    const response = await request(app)
      .post('/api/v1/assistant/query')
      .set('Authorization', 'Bearer valid-token')
      .send({
        clientInteractionId: 'assistant-1',
        questionText: 'Ano ang pinakamabenta today?',
        inputMode: 'voice',
        outputMode: 'text',
      })
      .expect(200);

    expect(mockedAnswerAssistantQueryForOwner).toHaveBeenCalledWith('user-123', {
      clientInteractionId: 'assistant-1',
      questionText: 'Ano ang pinakamabenta today?',
      inputMode: 'voice',
      outputMode: 'text',
    });
    expect(response.body).toEqual({
      clientInteractionId: 'assistant-1',
      status: 'answered',
      answerText: 'Coke Mismo ang pinaka-fast moving today.',
      spokenText: null,
      actions: [],
    });
  });

  it('returns 400 for invalid assistant payloads', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .post('/api/v1/assistant/query')
      .set('Authorization', 'Bearer valid-token')
      .send({
        clientInteractionId: 'assistant-1',
        questionText: '',
        inputMode: 'voice',
        outputMode: 'text',
      })
      .expect(400);

    expect(response.body).toEqual({
      message: 'Invalid assistant query payload.',
    });
  });
});
