import type { Request, Response } from 'express';

import { getSupabaseAdminClient } from '../config/supabase';

export function getCurrentUser(req: Request, res: Response) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  return res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      appMetadata: user.appMetadata,
      userMetadata: user.userMetadata,
    },
  });
}

type ExchangeGoogleIdTokenBody = {
  idToken?: unknown;
};

export async function exchangeGoogleIdToken(req: Request<unknown, unknown, ExchangeGoogleIdTokenBody>, res: Response) {
  const idToken = req.body?.idToken;

  if (typeof idToken !== 'string' || !idToken.trim()) {
    return res.status(400).json({
      message: 'idToken is required.',
    });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken.trim(),
  });

  if (error || !data.user || !data.session) {
    return res.status(401).json({
      message: 'Google token exchange failed.',
    });
  }

  return res.status(200).json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: data.session.token_type,
      expiresAt: data.session.expires_at,
      expiresIn: data.session.expires_in,
    },
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      appMetadata: data.user.app_metadata ?? {},
      userMetadata: data.user.user_metadata ?? {},
    },
  });
}
