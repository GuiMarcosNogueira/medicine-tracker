export type FamilyRole = 'owner' | 'editor' | 'viewer';

export interface Profile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Family {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMember {
  familyId: string;
  profileId: string;
  role: FamilyRole;
  joinedAt: string;
}

export interface FamilyInvite {
  id: string;
  familyId: string;
  invitedEmail: string;
  invitedRole: FamilyRole;
  token: string;
  invitedBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}
