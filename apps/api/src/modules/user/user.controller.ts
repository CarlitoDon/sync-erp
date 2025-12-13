import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { InviteUserSchema, AssignRoleSchema } from '@sync-erp/shared';

export class UserController {
  private service = new UserService();

  // GET /api/users/me
  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.userId!;
      const user = await this.service.getById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
      }
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/users/company - List members
  listCompanyMembers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const members = await this.service.listByCompany(companyId);
      res.json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/users/invite - Invite (Create + Assign)
  invite = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const { email, name } = InviteUserSchema.parse(req.body);

      // Check if user exists
      let user = await this.service.getByEmail(email);
      if (!user) {
        // Create user
        user = await this.service.create({ email, name }, companyId);
      } else {
        // Assign to company
        await this.service.assignToCompany(user.id, companyId);
      }

      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/users/assign - Assign existing user
  assign = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const { userId, roleId } = AssignRoleSchema.parse(req.body);

      await this.service.assignToCompany(userId, companyId, roleId);
      res.json({
        success: true,
        message: 'User assigned to company',
      });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/users/:id/company - Remove from company
  removeFromCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const companyId = req.context.companyId!;
      const userId = req.params.id;

      await this.service.removeFromCompany(userId, companyId);
      res.json({
        success: true,
        message: 'User removed from company',
      });
    } catch (error) {
      next(error);
    }
  };
}
