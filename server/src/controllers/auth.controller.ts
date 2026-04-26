import type { Request, Response } from 'express';

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
