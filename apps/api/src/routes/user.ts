import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { z } from 'zod';

export const userRouter = Router();
const userService = new UserService();

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

// GET /api/users - List users (in current company context)
userRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const users = await userService.listByCompany(companyId);
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

// POST /api/users - Create a new user
userRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateUserSchema.parse(req.body);
    const companyId = req.context.companyId!;

    const user = await userService.create(validated, companyId);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/:userId/assign - Assign user to current company
userRouter.post('/:userId/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const companyId = req.context.companyId!;

    const member = await userService.assignToCompany(userId, companyId);
    res.status(201).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});
