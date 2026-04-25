import type { Request, Response } from 'express';

import { clearProfileAvatarByUserId, getProfileByUserId, upsertProfileByUserId } from '../models/profile.model';

function getFallbackFullNameFromUserMetadata(user: NonNullable<Request['user']>) {
  const fullName = user.userMetadata.full_name;
  if (typeof fullName !== 'string') {
    return null;
  }

  const trimmed = fullName.trim();
  return trimmed || null;
}

type UpdateMyProfileBody = {
  fullName?: unknown;
  avatarUrl?: unknown;
};

export async function getMyProfile(req: Request, res: Response) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const profile = await getProfileByUserId(user.id);

  if (!profile) {
    return res.status(200).json({
      profile: {
        id: user.id,
        email: user.email,
        fullName: getFallbackFullNameFromUserMetadata(user),
        avatarUrl: null,
      },
    });
  }

  return res.status(200).json({
    profile,
  });
}

export async function updateMyProfile(req: Request<unknown, unknown, UpdateMyProfileBody>, res: Response) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const hasFullName = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'fullName');
  const hasAvatarUrl = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'avatarUrl');

  if (!hasFullName && !hasAvatarUrl) {
    return res.status(400).json({
      message: 'At least one profile field is required.',
    });
  }

  const rawFullName = req.body?.fullName;
  if (hasFullName && typeof rawFullName !== 'string') {
    return res.status(400).json({
      message: 'fullName must be a string.',
    });
  }

  const rawAvatarUrl = req.body?.avatarUrl;
  if (hasAvatarUrl && typeof rawAvatarUrl !== 'string') {
    return res.status(400).json({
      message: 'avatarUrl must be a string.',
    });
  }

  const profile = await upsertProfileByUserId({
    userId: user.id,
    userEmail: user.email,
    fullName: hasFullName ? ((rawFullName as string).trim() || null) : undefined,
    avatarUrl: hasAvatarUrl ? ((rawAvatarUrl as string).trim() || null) : undefined,
  });

  return res.status(200).json({
    profile,
  });
}

export async function clearMyProfileAvatar(req: Request, res: Response) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const profile = await clearProfileAvatarByUserId({
    userId: user.id,
    userEmail: user.email,
  });

  return res.status(200).json({
    profile,
  });
}
