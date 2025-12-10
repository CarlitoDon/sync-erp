export interface Company {
  id: string;
  name: string;
  inviteCode?: string; // Optional because only admins/members might see it, or it might be partial
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CreateCompanyDto {
  name: string;
}

export interface JoinCompanyDto {
  inviteCode: string;
}
